import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { buildOpnameFinalPdfBuffer } from "./opname-final.pdf";
import { OPNAME_FINAL_STATUS, type OpnameFinalStatus } from "./opname-final.constants";
import { opnameFinalRepository } from "./opname-final.repository";
import type { OpnameFinalListQueryInput } from "./opname-final.schema";

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveStatusTransition = (
    currentStatus: OpnameFinalStatus,
    action: ApprovalActionInput
): OpnameFinalStatus => {
    if (action.tindakan === "APPROVE") {
        if (action.jabatan === "DIREKTUR") {
            if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_DIREKTUR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval direktur`, 409);
            }
            return OPNAME_FINAL_STATUS.WAITING_FOR_COORDINATOR;
        }

        if (action.jabatan === "KOORDINATOR") {
            if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_COORDINATOR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval koordinator`, 409);
            }
            return OPNAME_FINAL_STATUS.WAITING_FOR_MANAGER;
        }

        if (action.jabatan === "MANAGER") {
            if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_MANAGER) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval manager`, 409);
            }
            return OPNAME_FINAL_STATUS.APPROVED;
        }

        throw new AppError(`Jabatan "${action.jabatan}" tidak dikenali`, 400);
    }

    if (action.jabatan === "DIREKTUR") {
        if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_DIREKTUR) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject direktur`, 409);
        }
        return OPNAME_FINAL_STATUS.REJECTED_BY_DIREKTUR;
    }

    if (action.jabatan === "KOORDINATOR") {
        if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_COORDINATOR) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject koordinator`, 409);
        }
        return OPNAME_FINAL_STATUS.REJECTED_BY_COORDINATOR;
    }

    if (action.jabatan === "MANAGER") {
        if (currentStatus !== OPNAME_FINAL_STATUS.WAITING_FOR_MANAGER) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject manager`, 409);
        }
        return OPNAME_FINAL_STATUS.REJECTED_BY_MANAGER;
    }

    throw new AppError(`Jabatan "${action.jabatan}" tidak dikenali`, 400);
};

const uploadPdfToDrive = async (buffer: Buffer, filename: string): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) {
        throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);
    }

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        "application/pdf",
        buffer,
        2,
        drive
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
};

const regeneratePdfAndUpload = async (opnameFinalId: string): Promise<string> => {
    const detail = await opnameFinalRepository.findById(opnameFinalId);
    if (!detail) {
        throw new AppError("Data opname_final tidak ditemukan", 404);
    }

    const pdfBuffer = await buildOpnameFinalPdfBuffer(detail);
    const proyek = sanitizeFilenamePart(detail.toko.proyek ?? undefined, "PROYEK");
    const nomorUlok = sanitizeFilenamePart(detail.toko.nomor_ulok ?? undefined, "ULOK");
    const filename = `OPNAME_FINAL_${proyek}_${nomorUlok}_${detail.opname_final.id}.pdf`;

    return uploadPdfToDrive(pdfBuffer, filename);
};

export const opnameFinalService = {
    async list(query: OpnameFinalListQueryInput) {
        return opnameFinalRepository.list(query);
    },

    async getById(id: string) {
        const data = await opnameFinalRepository.findById(id);
        if (!data) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        return data;
    },

    async handleApproval(id: string, action: ApprovalActionInput) {
        const detail = await opnameFinalRepository.findById(id);
        if (!detail) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        const currentStatus = detail.opname_final.status_opname_final;
        const newStatus = resolveStatusTransition(currentStatus, action);

        await opnameFinalRepository.updateApproval(id, newStatus, action);
        await opnameFinalRepository.updateTotals(id);

        const linkPdf = await regeneratePdfAndUpload(id);
        await opnameFinalRepository.updatePdfLink(id, linkPdf);

        return {
            id: Number(id),
            old_status: currentStatus,
            new_status: newStatus,
            link_pdf_opname: linkPdf
        };
    },

    async generatePdf(id: string) {
        const detail = await opnameFinalRepository.findById(id);
        if (!detail) {
            throw new AppError("Data opname_final tidak ditemukan", 404);
        }

        const pdfBuffer = await buildOpnameFinalPdfBuffer(detail);
        const proyek = sanitizeFilenamePart(detail.toko.proyek ?? undefined, "PROYEK");
        const nomorUlok = sanitizeFilenamePart(detail.toko.nomor_ulok ?? undefined, "ULOK");

        return {
            filename: `OPNAME_FINAL_${proyek}_${nomorUlok}_${id}.pdf`,
            pdfBuffer
        };
    }
};
