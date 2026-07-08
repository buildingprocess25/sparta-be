import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { scheduleAutomaticSerahTerimaIfReady } from "../serah-terima/serah-terima.service";
import { pengawasanRepository, type PengawasanRow } from "./pengawasan.repository";
import type {
    BulkUpdatePengawasanItemInput,
    CreatePengawasanData,
    CreatePengawasanInput,
    ListPengawasanQueryInput,
    UpdatePengawasanInput
} from "./pengawasan.schema";

type UploadedDokumentasiFile = {
    originalname: string;
    mimetype: string;
    buffer: Parameters<GoogleProvider["uploadFile"]>[3];
};

type PgError = {
    code?: string;
    constraint?: string;
};

const toPgError = (error: unknown): PgError => {
    if (typeof error === "object" && error !== null) {
        return error as PgError;
    }

    return {};
};

const mapPgError = (error: unknown): never => {
    const pgError = toPgError(error);

    if (pgError.code === "23503" && pgError.constraint === "fk_pengawasan_gantt") {
        throw new AppError("id_gantt tidak ditemukan di tabel gantt_chart", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_pengawasan_pengawasan_gantt_ref") {
        throw new AppError("id_pengawasan_gantt tidak ditemukan di tabel pengawasan_gantt", 404);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_pengawasan_status") {
        throw new AppError("status harus bernilai progress, selesai, atau terlambat", 400);
    }

    throw error;
};

const scheduleAutomaticSerahTerimaForRows = async (rows: PengawasanRow[]): Promise<void> => {
    const ganttIds = [...new Set(rows.map((row) => Number(row.id_gantt)).filter(Number.isInteger))];
    if (ganttIds.length === 0) return;

    const tokoResult = await pool.query<{ id_toko: number }>(
        `
        SELECT DISTINCT id_toko
        FROM gantt_chart
        WHERE id = ANY($1::int[])
          AND id_toko IS NOT NULL
        `,
        [ganttIds]
    );

    await Promise.all(
        tokoResult.rows.map((row) => scheduleAutomaticSerahTerimaIfReady(Number(row.id_toko)))
    );
};

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedDokumentasiFile): string => {
    const fromName = (() => {
        const rawName = file.originalname ?? "";
        const lastDot = rawName.lastIndexOf(".");
        if (lastDot <= 0 || lastDot === rawName.length - 1) return "";
        return rawName.slice(lastDot).toLowerCase();
    })();

    if (/^\.[a-z0-9]{1,10}$/.test(fromName)) {
        return fromName;
    }

    if (file.mimetype === "application/pdf") return ".pdf";
    if (file.mimetype === "image/jpeg") return ".jpg";
    if (file.mimetype === "image/png") return ".png";
    if (file.mimetype === "image/webp") return ".webp";
    return ".bin";
};

const uploadDokumentasiToDrive = async (
    idGantt: number,
    file: UploadedDokumentasiFile
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;

    if (!drive) {
        throw new AppError("Google Drive belum terkonfigurasi", 500);
    }

    const safeGantt = sanitizeFilenamePart(String(idGantt), "gantt");
    const ext = resolveFileExtension(file);
    const filename = `PENGAWASAN_DOKUMENTASI_${safeGantt}_${Date.now()}${ext}`;

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        file.mimetype || "application/octet-stream",
        file.buffer,
        2,
        drive
    );

    if (result.webViewLink) {
        return result.webViewLink;
    }

    if (result.id) {
        return `https://drive.google.com/file/d/${result.id}/view`;
    }

    throw new AppError("Upload dokumentasi ke Google Drive gagal", 500);
};

const detectImageMime = (buffer: Buffer, fallback?: string | null): string | null => {
    const head = buffer.slice(0, 12);
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "image/gif";
    if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    if (head.toString("ascii", 4, 8) === "ftyp") return "image/heic";
    if (fallback?.startsWith("image/")) return fallback;
    return null;
};

const imageBufferToPdfDataUrl = async (buffer: Buffer, mimeType?: string | null): Promise<string | null> => {
    try {
        const normalized = await sharp(buffer, { failOn: "none" })
            .rotate()
            // Kurangi quality dari 84 → 75 agar base64 lebih kecil di memori
            .jpeg({ quality: 75, mozjpeg: true })
            .resize({ width: 1280, withoutEnlargement: true })
            .toBuffer();

        return `data:image/jpeg;base64,${normalized.toString("base64")}`;
    } catch (error) {
        const detectedMime = detectImageMime(buffer, mimeType);
        if (!detectedMime || detectedMime === "image/heic") {
            console.error("[berkas_pengawasan] File dokumentasi bukan image yang bisa dibaca PDF:", {
                mimeType,
                size: buffer.length,
                error
            });
            return null;
        }

        console.error("[berkas_pengawasan] Gagal konversi foto pengawasan:", error);
        return `data:${detectedMime};base64,${buffer.toString("base64")}`;
    }
};

const uploadedDokumentasiToPdfDataUrl = async (file: UploadedDokumentasiFile): Promise<string | null> =>
    imageBufferToPdfDataUrl(Buffer.from(file.buffer), file.mimetype);

const extractGdriveFileId = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const byPath = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (byPath) return byPath[1];
    const byQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (byQuery) return byQuery[1];
    return null;
};

const gdriveImageToBase64 = async (url: string | null | undefined): Promise<string | null> => {
    if (url?.startsWith("data:image/")) return url;

    const fileId = extractGdriveFileId(url);
    if (!fileId) return null;

    const gp = GoogleProvider.instance;
    const drives = [gp.spartaDrive, gp.docDrive].filter(Boolean);

    for (const drive of drives) {
        if (!drive) continue;

        const buffer = await gp.getFileBufferById(drive, fileId);
        if (!buffer) continue;

        let mimeType: string | null | undefined;
        try {
            const meta = await drive.files.get({ fileId, fields: "mimeType", supportsAllDrives: true });
            mimeType = meta.data.mimeType;
        } catch {
            mimeType = null;
        }

        const dataUrl = await imageBufferToPdfDataUrl(buffer, mimeType);
        if (dataUrl) return dataUrl;
    }

    console.error("[berkas_pengawasan] Foto lama tidak bisa dibaca via token backend", { fileId });
    return null;
};

const resolvePengawasanPhotoBase64 = async (item: PengawasanRow): Promise<string | null> => {
    if (item.dokumentasi_base64) return item.dokumentasi_base64;

    const fromDrive = await gdriveImageToBase64(item.dokumentasi);
    if (fromDrive) {
        await pengawasanRepository.updateDokumentasiBase64(item.id, fromDrive)
            .catch((error) => console.error("[berkas_pengawasan] Gagal cache foto lama:", error));
    }

    return fromDrive;
};

const normalizeTanggalPengawasan = (value: string): string => {
    const trimmed = value.trim();

    const isoLike = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(trimmed);
    if (isoLike) {
        const [, year, month, day] = isoLike;
        return `${day}/${month}/${year}`;
    }

    return trimmed.replace(/-/g, "/");
};

const resolvePengawasanGanttId = async (
    idGantt: number,
    tanggalPengawasan: string,
    itemIndex?: number
): Promise<number> => {
    const normalizedTanggalPengawasan = normalizeTanggalPengawasan(tanggalPengawasan);

    const pengawasanGanttId = await pengawasanRepository.findPengawasanGanttIdByDate(
        idGantt,
        normalizedTanggalPengawasan
    );

    if (!pengawasanGanttId) {
        const context = typeof itemIndex === "number"
            ? ` pada items[${itemIndex}]`
            : "";

        throw new AppError(
            `tanggal_pengawasan tidak ditemukan di pengawasan_gantt${context} (id_gantt=${idGantt}, tanggal_pengawasan=${normalizedTanggalPengawasan})`,
            404
        );
    }

    return pengawasanGanttId;
};

const formatJakartaTimestamp = (): string =>
    new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(new Date());

const staticAssetPath = (filenameCandidates: string[]): string => {
    const candidates = filenameCandidates.flatMap((filename) => [
        path.resolve(__dirname, "../../image", filename),
        path.resolve(__dirname, "../../../src/image", filename),
    ]);

    for (const assetPath of candidates) {
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const mimeType = ext === ".png"
                ? "image/png"
                : ext === ".jpg" || ext === ".jpeg"
                    ? "image/jpeg"
                    : "application/octet-stream";

            const base64 = fs.readFileSync(assetPath).toString("base64");
            return `data:${mimeType};base64,${base64}`;
        }
    }

    return "";
};

/**
 * Generate PDF laporan pengawasan untuk suatu id_pengawasan_gantt,
 * upload ke Google Drive, lalu upsert link-nya ke tabel berkas_pengawasan.
 * Dipanggil setiap kali ada create pengawasan baru (akan menimpa PDF lama).
 */
const buildPengawasanPdfBuffer = async (
    idGantt: number,
    idPengawasanGantt: number,
    tanggalPengawasan: string
): Promise<Buffer> => {
    const rawItems = await pengawasanRepository.findAllPengawasanByGanttId(idPengawasanGantt);
    // Sequential (bukan Promise.all) agar tidak semua foto di-decode ke memori sekaligus
    const items: (typeof rawItems[number] & { dokumentasi_base64: string | null })[] = [];
    for (const item of rawItems) {
        items.push({
            ...item,
            dokumentasi_base64: await resolvePengawasanPhotoBase64(item)
        });
    }

    if (items.length === 0) {
        throw new AppError("Data pengawasan belum memiliki item", 404);
    }

    let countProgress = 0;
    let countSelesai = 0;
    let countTerlambat = 0;
    for (const item of items) {
        if (item.status === "progress") countProgress++;
        else if (item.status === "selesai") countSelesai++;
        else if (item.status === "terlambat") countTerlambat++;
    }

    const picPengawasan = await pengawasanRepository.findPicPengawasanByPengawasanGanttId(idPengawasanGantt);
    const templatePath = await resolveTemplatePath("pengawasan_report.njk");
    const html = await renderHtmlTemplate(templatePath, {
        id_gantt: idGantt,
        pic_pengawasan_nama: picPengawasan?.plc_building_support ?? null,
        tanggal_pengawasan: tanggalPengawasan,
        items,
        count_progress: countProgress,
        count_selesai: countSelesai,
        count_terlambat: countTerlambat,
        generated_at: formatJakartaTimestamp(),
        logo_watermark: staticAssetPath(["building-logo.png", "Building-Logo.png"])
    });

    return renderPdfFromHtml(html);
};

const generateAndUploadPengawasanPdf = async (
    idGantt: number,
    idPengawasanGantt: number,
    tanggalPengawasan: string
): Promise<void> => {
    try {
        const pdfBuffer = await buildPengawasanPdfBuffer(idGantt, idPengawasanGantt, tanggalPengawasan);

        // 5. Upload ke Google Drive (timpa berdasarkan nama unik per id_pengawasan_gantt)
        const gp = GoogleProvider.instance;
        const drive = gp.spartaDrive;
        if (!drive) {
            console.error("[berkas_pengawasan] Google Drive belum terkonfigurasi, skip upload PDF.");
            return;
        }

        // Hapus file PDF lama di Drive untuk id_pengawasan_gantt ini (jika ada)
        const existingBerkas = await pengawasanRepository.findBerkasByPengawasanGanttId(idPengawasanGantt);
        if (existingBerkas?.link_pdf_pengawasan) {
            const fileIdMatch = /\/d\/([a-zA-Z0-9_-]+)/.exec(existingBerkas.link_pdf_pengawasan);
            if (fileIdMatch?.[1]) {
                try {
                    await drive.files.delete({ fileId: fileIdMatch[1], supportsAllDrives: true });
                } catch {
                    // file mungkin sudah dihapus manual, abaikan
                }
            }
        }

        const filename = `PENGAWASAN_REPORT_GANTT${idGantt}_PG${idPengawasanGantt}_${Date.now()}.pdf`;
        const result = await gp.uploadFile(
            env.PDF_STORAGE_FOLDER_ID,
            filename,
            "application/pdf",
            pdfBuffer,
            2,
            drive
        );

        const link = result.webViewLink
            ?? (result.id ? `https://drive.google.com/file/d/${result.id}/view` : null);

        if (!link) {
            console.error("[berkas_pengawasan] Upload PDF berhasil tapi tidak mendapat link.");
            return;
        }

        // 6. Upsert ke tabel berkas_pengawasan
        await pengawasanRepository.upsertBerkasPengawasan(idPengawasanGantt, link);
        console.log(`[berkas_pengawasan] PDF berhasil digenerate & disimpan untuk id_pengawasan_gantt=${idPengawasanGantt}`);
    } catch (error) {
        // Jangan sampai error PDF generation menggagalkan create pengawasan
        console.error("[berkas_pengawasan] Gagal generate/upload PDF:", error);
    }
};

const regeneratePengawasanPdfForRow = async (row: Pick<PengawasanRow, "id_gantt" | "id_pengawasan_gantt">): Promise<void> => {
    const info = await pengawasanRepository.findPengawasanGanttInfoById(row.id_pengawasan_gantt);
    if (!info) return;

    generateAndUploadPengawasanPdf(row.id_gantt, row.id_pengawasan_gantt, info.tanggal_pengawasan)
        .catch((err) => console.error("[berkas_pengawasan] background error:", err));
};

const hasAnyUpdateField = (input: UpdatePengawasanInput): boolean =>
    typeof input.kategori_pekerjaan !== "undefined"
    || typeof input.jenis_pekerjaan !== "undefined"
    || typeof input.catatan !== "undefined"
    || typeof input.dokumentasi !== "undefined"
    || typeof input.status !== "undefined";

export const pengawasanService = {
    async listPendingMigrationPdfs(nomorUlok?: string) {
        return pengawasanRepository.findPendingMigrationPdfs(nomorUlok);
    },

    async create(
        input: CreatePengawasanInput,
        uploadedDokumentasi?: UploadedDokumentasiFile
    ): Promise<PengawasanRow> {
        try {
            const normalizedTanggal = normalizeTanggalPengawasan(input.tanggal_pengawasan);
            const idPengawasanGantt = await resolvePengawasanGanttId(
                input.id_gantt,
                input.tanggal_pengawasan
            );

            const dokumentasiLink = uploadedDokumentasi
                ? await uploadDokumentasiToDrive(input.id_gantt, uploadedDokumentasi)
                : undefined;
            const dokumentasiBase64 = uploadedDokumentasi
                ? await uploadedDokumentasiToPdfDataUrl(uploadedDokumentasi)
                : undefined;

            const { tanggal_pengawasan: _tanggalPengawasan, ...inputWithoutTanggal } = input;

            const payload: CreatePengawasanData = dokumentasiLink
                ? {
                    ...inputWithoutTanggal,
                    id_pengawasan_gantt: idPengawasanGantt,
                    dokumentasi: dokumentasiLink,
                    dokumentasi_base64: dokumentasiBase64 ?? undefined
                }
                : {
                    ...inputWithoutTanggal,
                    id_pengawasan_gantt: idPengawasanGantt
                };

            const row = await pengawasanRepository.create(payload);

            // Generate PDF & upsert berkas_pengawasan (fire-and-forget)
            generateAndUploadPengawasanPdf(input.id_gantt, idPengawasanGantt, normalizedTanggal)
                .catch((err) => console.error("[berkas_pengawasan] background error:", err));

            await scheduleAutomaticSerahTerimaForRows([row]);
            return row;
        } catch (error) {
            return mapPgError(error);
        }
    },

    async createBulk(
        items: CreatePengawasanInput[],
        uploadedDokumentasiFiles: UploadedDokumentasiFile[] = [],
        uploadedDokumentasiIndexes?: number[]
    ): Promise<PengawasanRow[]> {
        try {
            const resolvedGanttIds = new Map<number, { idPengawasanGantt: number; tanggal: string }>();

            // Sequential (bukan Promise.all) agar query ke DB tidak meledak paralel
            const basePayloads: CreatePengawasanData[] = [];
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const idPengawasanGantt = await resolvePengawasanGanttId(
                    item.id_gantt,
                    item.tanggal_pengawasan,
                    index
                );

                resolvedGanttIds.set(idPengawasanGantt, {
                    idPengawasanGantt,
                    tanggal: normalizeTanggalPengawasan(item.tanggal_pengawasan)
                });

                const { tanggal_pengawasan: _tanggalPengawasan, ...itemWithoutTanggal } = item;
                basePayloads.push({
                    ...itemWithoutTanggal,
                    id_pengawasan_gantt: idPengawasanGantt
                });
            }

            let rows: PengawasanRow[];

            if (uploadedDokumentasiFiles.length === 0) {
                rows = await pengawasanRepository.createBulk(basePayloads);
            } else if (uploadedDokumentasiIndexes && uploadedDokumentasiIndexes.length > 0) {
                if (uploadedDokumentasiIndexes.length !== uploadedDokumentasiFiles.length) {
                    throw new AppError(
                        "Jumlah file_dokumentasi_indexes harus sama dengan jumlah file_dokumentasi",
                        400
                    );
                }

                const usedIndexes = new Set<number>();
                const payloadWithDokumentasi: CreatePengawasanData[] = basePayloads.map((item) => ({ ...item }));

                for (let filePosition = 0; filePosition < uploadedDokumentasiFiles.length; filePosition++) {
                    const itemIndex = uploadedDokumentasiIndexes[filePosition];
                    if (itemIndex < 0 || itemIndex >= items.length) {
                        throw new AppError(
                            `file_dokumentasi_indexes[${filePosition}] di luar range items (0-${items.length - 1})`,
                            400
                        );
                    }

                    if (usedIndexes.has(itemIndex)) {
                        throw new AppError(
                            `file_dokumentasi_indexes tidak boleh duplikat (duplikat di index item ${itemIndex})`,
                            400
                        );
                    }
                    usedIndexes.add(itemIndex);

                    const item = basePayloads[itemIndex];
                    const dokumentasiLink = await uploadDokumentasiToDrive(item.id_gantt, uploadedDokumentasiFiles[filePosition]);
                    const dokumentasiBase64 = await uploadedDokumentasiToPdfDataUrl(uploadedDokumentasiFiles[filePosition]);
                    payloadWithDokumentasi[itemIndex] = {
                        ...item,
                        dokumentasi: dokumentasiLink,
                        dokumentasi_base64: dokumentasiBase64 ?? undefined
                    };
                }

                rows = await pengawasanRepository.createBulk(payloadWithDokumentasi);
            } else {
                if (uploadedDokumentasiFiles.length !== 1 && uploadedDokumentasiFiles.length !== items.length) {
                    throw new AppError(
                        "Jumlah file_dokumentasi harus 1 file untuk semua item, sama dengan jumlah items, atau kirim file_dokumentasi_indexes untuk mapping item tertentu",
                        400
                    );
                }

                const payloadWithDokumentasi: CreatePengawasanData[] = [];
                for (let index = 0; index < items.length; index++) {
                    const item = basePayloads[index];
                    const file = uploadedDokumentasiFiles.length === 1
                        ? uploadedDokumentasiFiles[0]
                        : uploadedDokumentasiFiles[index];

                    if (!file) {
                        payloadWithDokumentasi.push(item);
                        continue;
                    }

                    const dokumentasiLink = await uploadDokumentasiToDrive(item.id_gantt, file);
                    const dokumentasiBase64 = await uploadedDokumentasiToPdfDataUrl(file);
                    payloadWithDokumentasi.push({
                        ...item,
                        dokumentasi: dokumentasiLink,
                        dokumentasi_base64: dokumentasiBase64 ?? undefined
                    });
                }

                rows = await pengawasanRepository.createBulk(payloadWithDokumentasi);
            }

            // Generate PDF & upsert berkas_pengawasan for each unique id_pengawasan_gantt (fire-and-forget)
            const idGantt = items[0].id_gantt;
            for (const { idPengawasanGantt, tanggal } of resolvedGanttIds.values()) {
                generateAndUploadPengawasanPdf(idGantt, idPengawasanGantt, tanggal)
                    .catch((err) => console.error("[berkas_pengawasan] background error:", err));
            }

            await scheduleAutomaticSerahTerimaForRows(rows);
            return rows;
        } catch (error) {
            return mapPgError(error);
        }
    },

    async list(query: ListPengawasanQueryInput) {
        console.log('[PENGAWASAN SERVICE] list() called with query:', JSON.stringify(query));
        
        if (query.tanggal) {
            if (typeof query.id_gantt === "undefined") {
                throw new AppError("Query id_gantt wajib diisi jika menggunakan query tanggal", 400);
            }

            const idPengawasanGantt = await pengawasanRepository.findPengawasanGanttIdByDate(
                query.id_gantt,
                normalizeTanggalPengawasan(query.tanggal)
            );

            if (!idPengawasanGantt) {
                console.log('[PENGAWASAN SERVICE] No pengawasan_gantt found for tanggal:', query.tanggal);
                return [];
            }

            console.log('[PENGAWASAN SERVICE] Calling repository.findAll with idPengawasanGantt:', idPengawasanGantt);
            return pengawasanRepository.findAll(query, idPengawasanGantt);
        }

        console.log('[PENGAWASAN SERVICE] Calling repository.findAll without idPengawasanGantt');
        return pengawasanRepository.findAll(query);
    },

    async downloadPdf(idPengawasanGantt: number) {
        const info = await pengawasanRepository.findPengawasanGanttInfoById(idPengawasanGantt);
        if (!info) {
            throw new AppError("Data pengawasan tidak ditemukan", 404);
        }

        const buffer = await buildPengawasanPdfBuffer(
            info.id_gantt,
            info.id,
            info.tanggal_pengawasan
        );
        const filename = `PENGAWASAN_REPORT_GANTT${info.id_gantt}_PG${info.id}.pdf`;

        return { buffer, filename };
    },

    async getById(id: string) {
        const data = await pengawasanRepository.findById(id);
        if (!data) {
            throw new AppError("Data pengawasan tidak ditemukan", 404);
        }

        return data;
    },

    async update(
        id: string,
        input: UpdatePengawasanInput,
        uploadedDokumentasi?: UploadedDokumentasiFile
    ): Promise<PengawasanRow> {
        try {
            if (!hasAnyUpdateField(input) && !uploadedDokumentasi) {
                throw new AppError("Minimal satu field harus diisi untuk update atau kirim rev_file_dokumentasi", 400);
            }

            const existing = await pengawasanRepository.findById(id);
            if (!existing) {
                throw new AppError("Data pengawasan tidak ditemukan", 404);
            }

            const dokumentasiLink = uploadedDokumentasi
                ? await uploadDokumentasiToDrive(existing.id_gantt, uploadedDokumentasi)
                : undefined;
            const dokumentasiBase64 = uploadedDokumentasi
                ? await uploadedDokumentasiToPdfDataUrl(uploadedDokumentasi)
                : undefined;

            const payload = dokumentasiLink
                ? { ...input, dokumentasi: dokumentasiLink, dokumentasi_base64: dokumentasiBase64 ?? undefined }
                : input;

            const data = await pengawasanRepository.updateById(id, payload);
            if (!data) {
                throw new AppError("Data pengawasan tidak ditemukan", 404);
            }

            await regeneratePengawasanPdfForRow(data);

            await scheduleAutomaticSerahTerimaForRows([data]);
            return data;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            return mapPgError(error);
        }
    },

    async updateBulk(
        items: BulkUpdatePengawasanItemInput[],
        uploadedDokumentasiFiles: UploadedDokumentasiFile[] = [],
        uploadedDokumentasiIndexes?: number[]
    ): Promise<PengawasanRow[]> {
        try {
            const fileByItemIndex = new Map<number, UploadedDokumentasiFile>();

            if (uploadedDokumentasiFiles.length > 0) {
                if (uploadedDokumentasiIndexes && uploadedDokumentasiIndexes.length > 0) {
                    if (uploadedDokumentasiIndexes.length !== uploadedDokumentasiFiles.length) {
                        throw new AppError(
                            "Jumlah rev_file_dokumentasi_indexes harus sama dengan jumlah rev_file_dokumentasi",
                            400
                        );
                    }

                    const usedIndexes = new Set<number>();
                    for (let filePosition = 0; filePosition < uploadedDokumentasiFiles.length; filePosition++) {
                        const itemIndex = uploadedDokumentasiIndexes[filePosition];
                        if (itemIndex < 0 || itemIndex >= items.length) {
                            throw new AppError(
                                `rev_file_dokumentasi_indexes[${filePosition}] di luar range items (0-${items.length - 1})`,
                                400
                            );
                        }

                        if (usedIndexes.has(itemIndex)) {
                            throw new AppError(
                                `rev_file_dokumentasi_indexes tidak boleh duplikat (duplikat di index item ${itemIndex})`,
                                400
                            );
                        }

                        usedIndexes.add(itemIndex);
                        fileByItemIndex.set(itemIndex, uploadedDokumentasiFiles[filePosition]);
                    }
                } else {
                    if (uploadedDokumentasiFiles.length !== items.length) {
                        throw new AppError(
                            "Jumlah rev_file_dokumentasi harus sama dengan jumlah items, atau kirim rev_file_dokumentasi_indexes untuk mapping item tertentu",
                            400
                        );
                    }

                    uploadedDokumentasiFiles.forEach((file, index) => {
                        fileByItemIndex.set(index, file);
                    });
                }
            }

            const usedIds = new Set<number>();
            const updatedRows: PengawasanRow[] = [];
            // Kumpulkan id_pengawasan_gantt yang unik agar PDF hanya digenerate
            // sekali per tanggal, bukan sekali per item (mencegah OOM)
            const ganttIdsToRegenerate = new Set<number>();

            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                if (usedIds.has(item.id)) {
                    throw new AppError(`id duplikat ditemukan pada items[${index}] (id=${item.id})`, 400);
                }
                usedIds.add(item.id);

                const { id, ...rawPayload } = item;
                const payload: UpdatePengawasanInput = rawPayload;
                const uploadedDokumentasi = fileByItemIndex.get(index);

                if (!hasAnyUpdateField(payload) && !uploadedDokumentasi) {
                    throw new AppError(
                        `Minimal satu field update atau rev_file_dokumentasi wajib diisi pada items[${index}]`,
                        400
                    );
                }

                const existing = await pengawasanRepository.findById(String(id));
                if (!existing) {
                    throw new AppError(`Data pengawasan tidak ditemukan pada items[${index}] (id=${id})`, 404);
                }

                const dokumentasiLink = uploadedDokumentasi
                    ? await uploadDokumentasiToDrive(existing.id_gantt, uploadedDokumentasi)
                    : undefined;
                const dokumentasiBase64 = uploadedDokumentasi
                    ? await uploadedDokumentasiToPdfDataUrl(uploadedDokumentasi)
                    : undefined;

                const finalPayload = dokumentasiLink
                    ? { ...payload, dokumentasi: dokumentasiLink, dokumentasi_base64: dokumentasiBase64 ?? undefined }
                    : payload;

                const data = await pengawasanRepository.updateById(String(id), finalPayload);
                if (!data) {
                    throw new AppError(`Data pengawasan tidak ditemukan pada items[${index}] (id=${id})`, 404);
                }

                // Tandai id_pengawasan_gantt untuk regenerasi PDF di akhir (deduplication)
                ganttIdsToRegenerate.add(data.id_pengawasan_gantt);
                updatedRows.push(data);
            }

            // Generate PDF sekali per id_pengawasan_gantt (fire-and-forget)
            // Ini mencegah N concurrent PDF generation yang bisa crash server
            for (const pgId of ganttIdsToRegenerate) {
                const representativeRow = updatedRows.find(r => r.id_pengawasan_gantt === pgId);
                if (representativeRow) {
                    regeneratePengawasanPdfForRow(representativeRow)
                        .catch((err) => console.error("[berkas_pengawasan] bulk regenerate error:", err));
                }
            }

            await scheduleAutomaticSerahTerimaForRows(updatedRows);
            return updatedRows;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            return mapPgError(error);
        }
    },

    async remove(id: string) {
        const deleted = await pengawasanRepository.deleteById(id);
        if (!deleted) {
            throw new AppError("Data pengawasan tidak ditemukan", 404);
        }

        return { id: Number(id), deleted: true };
    }
};
