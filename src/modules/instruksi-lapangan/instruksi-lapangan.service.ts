import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { AppError } from "../../common/app-error";
import { env } from "../../config/env";
import { GoogleProvider } from "../../common/google";
import type { ApprovalActionInput } from "../approval/approval.schema";
import type { ListInstruksiLapanganQuery, SubmitInstruksiLapanganInput } from "./instruksi-lapangan.schema";
import { instruksiLapanganRepository } from "./instruksi-lapangan.repository";
import {
    buildInstruksiLapanganPdfBuffer,
    buildInstruksiLapanganRecapPdfBuffer,
    mergePdfBuffers
} from "./instruksi-lapangan.pdf";

const saveUploadToTemp = async (file: { originalname: string; buffer: Buffer }): Promise<string> => {
    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;
    const tmpPath = path.join(process.cwd(), "tmp", filename);
    
    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    await fs.writeFile(tmpPath, file.buffer);
    
    return tmpPath;
};

const extractDriveFileId = (value: string): string | null => {
    const match = value.match(/id=([^&]+)/) || value.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};



async function uploadPdfToDrive(buffer: Buffer, filename: string): Promise<string> {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        "application/pdf",
        buffer,
        2,
        drive,
    );
    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
}

const normalizeNoPpnText = (value?: string | null): string => String(value ?? "").trim().toUpperCase();

const isNoPpnArea = (toko: { cabang?: string | null; nama_toko?: string | null; alamat?: string | null }): boolean => {
    const identity = [
        toko.cabang,
        toko.nama_toko,
        toko.alamat,
    ].map(normalizeNoPpnText);

    return identity.some(value => value === "BATAM" || value === "BINTAN" || /\bBATAM\b|\bBINTAN\b/.test(value));
};

const generateInstruksiLapanganPdfInBackground = (idIL: number | string): void => {
    setImmediate(() => {
        instruksiLapanganService.generateAndStorePdf(idIL).catch((err) => {
            console.error("[IL][PDF_BACKGROUND] Gagal generate/upload PDF Instruksi Lapangan", {
                idIL,
                error: err instanceof Error ? err.message : String(err)
            });
        });
    });
};

export const instruksiLapanganService = {
    async submit(
        payload: SubmitInstruksiLapanganInput,
        files: { lampiranFile?: { originalname: string; buffer: Buffer; mimetype: string } }
    ) {
        // Validate Toko. Prefer id_toko because nomor_ulok can exist for multiple scopes (Sipil/ME).
        const toko = payload.id_toko
            ? await instruksiLapanganRepository.getTokoById(payload.id_toko)
            : await instruksiLapanganRepository.getTokoByUlok(payload.nomor_ulok, payload.lingkup_pekerjaan);

        if (!toko) {
            throw new AppError(`Toko dengan nomor ULOK ${payload.nomor_ulok} tidak ditemukan`, 404);
        }

        if (toko.nomor_ulok !== payload.nomor_ulok) {
            throw new AppError("id_toko tidak sesuai dengan nomor ULOK yang dipilih", 409);
        }

        if (
            payload.lingkup_pekerjaan &&
            toko.lingkup_pekerjaan &&
            toko.lingkup_pekerjaan.trim().toUpperCase() !== payload.lingkup_pekerjaan.trim().toUpperCase()
        ) {
            throw new AppError("id_toko tidak sesuai dengan lingkup pekerjaan yang dipilih", 409);
        }

        console.log("[IL][SUBMIT_SERVICE] Toko tervalidasi, mulai simpan", {
            id_toko: toko.id,
            nomor_ulok: toko.nomor_ulok,
            lingkup_pekerjaan: toko.lingkup_pekerjaan,
            item_count: payload.detail_items.length,
            is_revisi: Boolean(payload.id_instruksi_lapangan_revisi)
        });

        let lampiranPath: string | undefined;

        if (files.lampiranFile) {
            lampiranPath = await saveUploadToTemp(files.lampiranFile);
        }

        let idInstruksiLapangan: number;

        if (payload.id_instruksi_lapangan_revisi) {
            const existing = await instruksiLapanganRepository.getHeaderAndToko(payload.id_instruksi_lapangan_revisi);
            if (!existing) {
                throw new AppError("Instruksi Lapangan revisi tidak ditemukan", 404);
            }
            if (existing.instruksiLapangan.id_toko !== toko.id) {
                throw new AppError("Instruksi Lapangan revisi tidak sesuai dengan ULOK yang dipilih", 409);
            }
            if (existing.instruksiLapangan.status.toUpperCase() !== "DITOLAK") {
                throw new AppError("Hanya Instruksi Lapangan berstatus Ditolak yang dapat direvisi", 409);
            }

            idInstruksiLapangan = await instruksiLapanganRepository.replaceRejectedWithDetails(
                existing.instruksiLapangan.id,
                payload,
                lampiranPath
            );
        } else {
            idInstruksiLapangan = await instruksiLapanganRepository.insertWithItems(
                payload,
                toko.id,
                lampiranPath
            );
        }

        console.log("[IL][SUBMIT_SERVICE] Data IL berhasil tersimpan", {
            id_instruksi_lapangan: idInstruksiLapangan,
            id_toko: toko.id
        });

        // Jangan tahan response user pada proses render/upload PDF ke Drive.
        // PDF tetap dibuat background dan link akan terisi ketika proses selesai.
        generateInstruksiLapanganPdfInBackground(idInstruksiLapangan);

        return await instruksiLapanganRepository.getById(idInstruksiLapangan);
    },

    async generateAndStorePdf(idIL: number | string) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(idIL);
        if (!data) return;

        const items = await instruksiLapanganRepository.getItems(idIL);
        
        const noPpn = isNoPpnArea(data.toko);

        const reportBuffer = await buildInstruksiLapanganPdfBuffer({
            instruksiLapangan: data.instruksiLapangan,
            items,
            toko: data.toko
        });

        const recapBuffer = await buildInstruksiLapanganRecapPdfBuffer({
            instruksiLapangan: data.instruksiLapangan,
            items,
            toko: data.toko
        });

        const buffersToMerge: Buffer[] = [recapBuffer, reportBuffer];

        // Also merge lampiran if it's a PDF
        if (data.instruksiLapangan.link_lampiran) {
            try {
                const lampiranBuffer = await fs.readFile(data.instruksiLapangan.link_lampiran);
                // check if it's pdf magic number
                if (lampiranBuffer.subarray(0, 4).toString('hex') === '25504446') {
                    buffersToMerge.push(lampiranBuffer);
                }
            } catch (err) {
                console.warn("Could not read lampiran for merging", err);
            }
        }

        const mergedBuffer = await mergePdfBuffers(buffersToMerge);

        const pdfFilename = `Instruksi_Lapangan_${data.toko.nomor_ulok}_${Date.now()}`;

        const [linkGabungan, linkNonSbo, linkRekap] = await Promise.all([
            uploadPdfToDrive(mergedBuffer, `${pdfFilename}_Gabungan.pdf`),
            uploadPdfToDrive(reportBuffer, `${pdfFilename}_NonSBO.pdf`),
            uploadPdfToDrive(recapBuffer, `${pdfFilename}_Rekapitulasi.pdf`)
        ]);

        const total = items.reduce((acc, item) => acc + Number(item.total_harga || 0), 0);
        const roundedDown = Math.floor(total / 10000) * 10000;
        const ppn = noPpn ? 0 : roundedDown * 0.11;
        const finalTotal = roundedDown + ppn;

        await instruksiLapanganRepository.updatePdfLinks(idIL, {
            pdfGabungan: linkGabungan || "",
            pdfNonSbo: linkNonSbo || "",
            pdfRekapitulasi: linkRekap || "",
            grandTotalNonSbo: total.toString(),
            grandTotalFinal: finalTotal.toString()
        });
    },

    async list(query: ListInstruksiLapanganQuery) {
        return await instruksiLapanganRepository.findMany(query);
    },

    async getById(id: string) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const items = await instruksiLapanganRepository.getItems(id);
        return { ...data.instruksiLapangan, toko: data.toko, items };
    },

    async getPdfDownloadPayload(id: string) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const items = await instruksiLapanganRepository.getItems(id);
        
        const reportBuffer = await buildInstruksiLapanganPdfBuffer({
            instruksiLapangan: data.instruksiLapangan,
            items,
            toko: data.toko
        });

        const recapBuffer = await buildInstruksiLapanganRecapPdfBuffer({
            instruksiLapangan: data.instruksiLapangan,
            items,
            toko: data.toko
        });

        const buffersToMerge: Buffer[] = [recapBuffer, reportBuffer];
        if (data.instruksiLapangan.link_lampiran) {
            try {
                const lampiranBuffer = await fs.readFile(data.instruksiLapangan.link_lampiran);
                if (lampiranBuffer.subarray(0, 4).toString('hex') === '25504446') {
                    buffersToMerge.push(lampiranBuffer);
                }
            } catch (err) {
                console.warn("Could not read lampiran for merging", err);
            }
        }

        const mergedBuffer = await mergePdfBuffers(buffersToMerge);

        return {
            filename: `Instruksi_Lapangan_${data.toko.nomor_ulok}.pdf`,
            pdfBuffer: mergedBuffer
        };
    },

    async getAssetDownloadPayload(id: string, assetType: "lampiran") {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const assetPath = data.instruksiLapangan.link_lampiran;
        if (!assetPath) {
            throw new AppError(`File ${assetType} tidak tersedia untuk Instruksi Lapangan ini`, 404);
        }

        try {
            const buffer = await fs.readFile(assetPath);
            const ext = path.extname(assetPath).toLowerCase();
            const contentType = ext === ".pdf" ? "application/pdf"
                : ext === ".png" ? "image/png"
                : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
                : "application/octet-stream";

            return {
                filename: `${assetType}_${data.toko.nomor_ulok}${ext}`,
                contentType,
                fileBuffer: buffer
            };
        } catch {
            throw new AppError(`File ${assetType} tidak dapat dibaca dari server`, 500);
        }
    },

    async handleApproval(id: string, action: ApprovalActionInput) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const currentStatus = data.instruksiLapangan.status;

        if (action.tindakan === "APPROVE") {
            if (currentStatus === "Menunggu Persetujuan Koordinator") {
                if (action.jabatan !== "KOORDINATOR") {
                    throw new AppError("Instruksi Lapangan saat ini menunggu approval Koordinator", 403);
                }

                await instruksiLapanganRepository.updateApproval(
                    id,
                    "Menunggu Persetujuan Manager",
                    "koordinator",
                    action.approver_email,
                    undefined,
                    action.catatan_approval ?? null
                );
            } else if (currentStatus === "Menunggu Persetujuan Manager") {
                if (action.jabatan !== "MANAGER") {
                    throw new AppError("Instruksi Lapangan saat ini menunggu approval Manager", 403);
                }

                await instruksiLapanganRepository.updateApproval(
                    id,
                    "Disetujui",
                    "manager",
                    action.approver_email,
                    undefined,
                    action.catatan_approval ?? null
                );
            } else {
                throw new AppError(`Status tidak dapat di-approve dari state saat ini: ${currentStatus}`, 400);
            }
        } else if (action.tindakan === "REJECT") {
            const role = currentStatus === "Menunggu Persetujuan Koordinator" ? "koordinator"
                : currentStatus === "Menunggu Persetujuan Manager" ? "manager"
                : null;

            if (!role) {
                throw new AppError(`Status tidak dapat di-reject dari state saat ini: ${currentStatus}`, 400);
            }

            if (
                (role === "koordinator" && action.jabatan !== "KOORDINATOR") ||
                (role === "manager" && action.jabatan !== "MANAGER")
            ) {
                throw new AppError(`Instruksi Lapangan saat ini menunggu approval ${role === "koordinator" ? "Koordinator" : "Manager"}`, 403);
            }
            
            await instruksiLapanganRepository.updateApproval(
                id,
                "Ditolak",
                role,
                action.approver_email,
                action.alasan_penolakan ?? undefined,
                action.catatan_approval ?? null
            );
        } else {
            throw new AppError("Action tidak valid", 400);
        }

        // Regenerate PDF after status change
        await this.generateAndStorePdf(id);

        return await instruksiLapanganRepository.getById(id);
    }
};
