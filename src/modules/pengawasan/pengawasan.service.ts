import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
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

const hasAnyUpdateField = (input: UpdatePengawasanInput): boolean =>
    typeof input.kategori_pekerjaan !== "undefined"
    || typeof input.jenis_pekerjaan !== "undefined"
    || typeof input.catatan !== "undefined"
    || typeof input.dokumentasi !== "undefined"
    || typeof input.status !== "undefined";

export const pengawasanService = {
    async create(
        input: CreatePengawasanInput,
        uploadedDokumentasi?: UploadedDokumentasiFile
    ): Promise<PengawasanRow> {
        try {
            const idPengawasanGantt = await resolvePengawasanGanttId(
                input.id_gantt,
                input.tanggal_pengawasan
            );

            const dokumentasiLink = uploadedDokumentasi
                ? await uploadDokumentasiToDrive(input.id_gantt, uploadedDokumentasi)
                : undefined;

            const { tanggal_pengawasan: _tanggalPengawasan, ...inputWithoutTanggal } = input;

            const payload: CreatePengawasanData = dokumentasiLink
                ? {
                    ...inputWithoutTanggal,
                    id_pengawasan_gantt: idPengawasanGantt,
                    dokumentasi: dokumentasiLink
                }
                : {
                    ...inputWithoutTanggal,
                    id_pengawasan_gantt: idPengawasanGantt
                };

            return await pengawasanRepository.create(payload);
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
            const basePayloads = await Promise.all(
                items.map(async (item, index): Promise<CreatePengawasanData> => {
                    const idPengawasanGantt = await resolvePengawasanGanttId(
                        item.id_gantt,
                        item.tanggal_pengawasan,
                        index
                    );

                    const { tanggal_pengawasan: _tanggalPengawasan, ...itemWithoutTanggal } = item;
                    return {
                        ...itemWithoutTanggal,
                        id_pengawasan_gantt: idPengawasanGantt
                    };
                })
            );

            if (uploadedDokumentasiFiles.length === 0) {
                return await pengawasanRepository.createBulk(basePayloads);
            }

            if (uploadedDokumentasiIndexes && uploadedDokumentasiIndexes.length > 0) {
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
                    payloadWithDokumentasi[itemIndex] = {
                        ...item,
                        dokumentasi: dokumentasiLink
                    };
                }

                return await pengawasanRepository.createBulk(payloadWithDokumentasi);
            }

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
                payloadWithDokumentasi.push({
                    ...item,
                    dokumentasi: dokumentasiLink
                });
            }

            return await pengawasanRepository.createBulk(payloadWithDokumentasi);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async list(query: ListPengawasanQueryInput) {
        if (query.tanggal) {
            if (typeof query.id_gantt === "undefined") {
                throw new AppError("Query id_gantt wajib diisi jika menggunakan query tanggal", 400);
            }

            const idPengawasanGantt = await pengawasanRepository.findPengawasanGanttIdByDate(
                query.id_gantt,
                normalizeTanggalPengawasan(query.tanggal)
            );

            if (!idPengawasanGantt) {
                return [];
            }

            return pengawasanRepository.findAll(query, idPengawasanGantt);
        }

        return pengawasanRepository.findAll(query);
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

            const payload = dokumentasiLink
                ? { ...input, dokumentasi: dokumentasiLink }
                : input;

            const data = await pengawasanRepository.updateById(id, payload);
            if (!data) {
                throw new AppError("Data pengawasan tidak ditemukan", 404);
            }

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

                const finalPayload = dokumentasiLink
                    ? { ...payload, dokumentasi: dokumentasiLink }
                    : payload;

                const data = await pengawasanRepository.updateById(String(id), finalPayload);
                if (!data) {
                    throw new AppError(`Data pengawasan tidak ditemukan pada items[${index}] (id=${id})`, 404);
                }

                updatedRows.push(data);
            }

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
