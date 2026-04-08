import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { spkRepository } from "../spk/spk.repository";
import { tokoRepository } from "../toko/toko.repository";
import { buildPertambahanSpkPdfBuffer } from "./pertambahan-spk.pdf";
import {
    pertambahanSpkRepository,
    type PertambahanSpkDetailRow
} from "./pertambahan-spk.repository";
import type {
    CreatePertambahanSpkInput,
    PertambahanSpkApprovalInput,
    PertambahanSpkListQuery,
    UpdatePertambahanSpkInput
} from "./pertambahan-spk.schema";

const PERTAMBAHAN_SPK_STATUS = {
    WAITING_FOR_BM_APPROVAL: "Menunggu Persetujuan",
    APPROVED_BY_BM: "Disetujui BM",
    REJECTED_BY_BM: "Ditolak BM"
} as const;

const APPROVAL_ALLOWED_STATUS = new Set<string>([
    PERTAMBAHAN_SPK_STATUS.WAITING_FOR_BM_APPROVAL,
    "WAITING_FOR_BM_APPROVAL"
]);

interface UploadedLampiranPendukungFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
}

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedLampiranPendukungFile): string => {
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
    return ".bin";
};

const uploadLampiranPendukungToDrive = async (
    file: UploadedLampiranPendukungFile,
    nomorUlok: string,
    proyek?: string,
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const safeProyek = sanitizeFilenamePart(proyek, "PROYEK");
    const safeUlok = sanitizeFilenamePart(nomorUlok, "ULOK");
    const ext = resolveFileExtension(file);
    const filename = `PERTAMBAHAN_SPK_LAMPIRAN_${safeProyek}_${safeUlok}_${Date.now()}${ext}`;

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        file.mimetype || "application/octet-stream",
        file.buffer,
        2,
        drive,
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
};

const uploadPdfToDrive = async (buffer: Buffer, filename: string): Promise<string> => {
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
};

async function ensureSpkExists(idSpk: number) {
    const spk = await spkRepository.findById(String(idSpk));
    if (!spk) {
        throw new AppError("SPK tidak ditemukan", 404);
    }

    return spk;
}

export const pertambahanSpkService = {
    async create(
        payload: CreatePertambahanSpkInput,
        uploadedLampiranPendukung?: UploadedLampiranPendukungFile
    ): Promise<PertambahanSpkDetailRow> {
        const spk = await ensureSpkExists(payload.id_spk);
        const toko = await tokoRepository.findByNomorUlok(spk.pengajuan.nomor_ulok);

        const targetRejectedRecord = payload.id
            ? await pertambahanSpkRepository.findById(String(payload.id))
            : await pertambahanSpkRepository.findLatestRejectedBySpkId(payload.id_spk);

        if (targetRejectedRecord && targetRejectedRecord.id_spk !== String(payload.id_spk)) {
            throw new AppError("Data revisi tidak sesuai dengan id_spk", 409);
        }

        if (payload.id && !targetRejectedRecord) {
            throw new AppError("Data pertambahan SPK tidak ditemukan", 404);
        }

        if (
            targetRejectedRecord &&
            targetRejectedRecord.status_persetujuan !== PERTAMBAHAN_SPK_STATUS.REJECTED_BY_BM
        ) {
            throw new AppError(
                `Hanya data dengan status ${PERTAMBAHAN_SPK_STATUS.REJECTED_BY_BM} yang bisa direvisi`,
                409
            );
        }

        const linkLampiranPendukung = uploadedLampiranPendukung
            ? await uploadLampiranPendukungToDrive(
                uploadedLampiranPendukung,
                spk.pengajuan.nomor_ulok,
                spk.pengajuan.proyek,
            )
            : payload.link_lampiran_pendukung?.trim() || targetRejectedRecord?.link_lampiran_pendukung || null;

        const pdfBuffer = await buildPertambahanSpkPdfBuffer({
            nomorUlok: spk.pengajuan.nomor_ulok,
            nomorSpk: spk.pengajuan.nomor_spk,
            cabang: toko?.cabang,
            tanggalSpkAkhir: payload.tanggal_spk_akhir,
            tanggalSpkAkhirSetelahPerpanjangan: payload.tanggal_spk_akhir_setelah_perpanjangan,
            pertambahanHari: payload.pertambahan_hari,
            alasanPerpanjangan: payload.alasan_perpanjangan,
            dibuatOleh: payload.dibuat_oleh,
            dibuatPada: new Date().toISOString(),
            disetujuiOleh: payload.disetujui_oleh,
            disetujuiPada: payload.waktu_persetujuan,
        });
        const safeNomorSpk = sanitizeFilenamePart(spk.pengajuan.nomor_spk, "SPK");
        const pdfFilename = `FORM_PERPANJANGAN_SPK_${safeNomorSpk}_${Date.now()}.pdf`;
        const linkPdf = await uploadPdfToDrive(pdfBuffer, pdfFilename);

        let data: PertambahanSpkDetailRow | null;
        if (targetRejectedRecord) {
            data = await pertambahanSpkRepository.updateById(targetRejectedRecord.id, {
                id_spk: payload.id_spk,
                pertambahan_hari: payload.pertambahan_hari,
                tanggal_spk_akhir: payload.tanggal_spk_akhir,
                tanggal_spk_akhir_setelah_perpanjangan: payload.tanggal_spk_akhir_setelah_perpanjangan,
                alasan_perpanjangan: payload.alasan_perpanjangan,
                dibuat_oleh: payload.dibuat_oleh,
                status_persetujuan: PERTAMBAHAN_SPK_STATUS.WAITING_FOR_BM_APPROVAL,
                disetujui_oleh: null,
                waktu_persetujuan: null,
                alasan_penolakan: null,
                link_pdf: linkPdf,
                link_lampiran_pendukung: linkLampiranPendukung,
            });
        } else {
            const created = await pertambahanSpkRepository.create({
                ...payload,
                status_persetujuan: PERTAMBAHAN_SPK_STATUS.WAITING_FOR_BM_APPROVAL,
                disetujui_oleh: undefined,
                waktu_persetujuan: undefined,
                alasan_penolakan: undefined,
                link_pdf: linkPdf,
                link_lampiran_pendukung: linkLampiranPendukung ?? undefined,
            });

            data = await pertambahanSpkRepository.findById(created.id);
        }

        if (!data) {
            throw new AppError("Pertambahan SPK gagal dibuat", 500);
        }

        return data;
    },

    async list(query: PertambahanSpkListQuery): Promise<PertambahanSpkDetailRow[]> {
        return pertambahanSpkRepository.list(query);
    },

    async getById(id: string): Promise<PertambahanSpkDetailRow> {
        const data = await pertambahanSpkRepository.findById(id);
        if (!data) {
            throw new AppError("Data pertambahan SPK tidak ditemukan", 404);
        }

        return data;
    },

    async updateById(id: string, payload: UpdatePertambahanSpkInput): Promise<PertambahanSpkDetailRow> {
        const existing = await pertambahanSpkRepository.findById(id);
        if (!existing) {
            throw new AppError("Data pertambahan SPK tidak ditemukan", 404);
        }

        if (payload.id_spk !== undefined) {
            await ensureSpkExists(payload.id_spk);
        }

        const updated = await pertambahanSpkRepository.updateById(id, payload);
        if (!updated) {
            throw new AppError("Data pertambahan SPK tidak ditemukan", 404);
        }

        return updated;
    },

    async deleteById(id: string): Promise<void> {
        const isDeleted = await pertambahanSpkRepository.deleteById(id);
        if (!isDeleted) {
            throw new AppError("Data pertambahan SPK tidak ditemukan", 404);
        }
    },

    async handleApproval(id: string, action: PertambahanSpkApprovalInput): Promise<PertambahanSpkDetailRow> {
        const existing = await pertambahanSpkRepository.findById(id);
        if (!existing) {
            throw new AppError("Data pertambahan SPK tidak ditemukan", 404);
        }

        if (!APPROVAL_ALLOWED_STATUS.has(existing.status_persetujuan)) {
            throw new AppError(
                `Tindakan sudah diproses. Status saat ini: ${existing.status_persetujuan}`,
                409
            );
        }

        const nextStatus = action.tindakan === "APPROVE"
            ? PERTAMBAHAN_SPK_STATUS.APPROVED_BY_BM
            : PERTAMBAHAN_SPK_STATUS.REJECTED_BY_BM;

        const updated = await pertambahanSpkRepository.applyApproval(id, nextStatus, action);
        if (!updated) {
            throw new AppError("Data pertambahan SPK tidak ditemukan", 404);
        }

        return updated;
    }
};
