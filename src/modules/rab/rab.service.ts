import { AppError } from "../../common/app-error";
import { tokoRepository } from "../toko/toko.repository";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { RAB_STATUS, type RabStatus } from "./rab.constants";
import { buildRabPdfBuffer } from "./rab.pdf";
import { rabRepository } from "./rab.repository";
import type { DetailItemInput, RabListQuery, SubmitRabInput } from "./rab.schema";

const computeTotals = (detailItems: DetailItemInput[]) => {
    let totalAllItems = 0;
    let totalNonSbo = 0;

    for (const item of detailItems) {
        const totalItem = item.volume * (item.harga_material + item.harga_upah);
        totalAllItems += totalItem;

        if (item.kategori_pekerjaan.trim().toUpperCase() !== "PEKERJAAN SBO") {
            totalNonSbo += totalItem;
        }
    }

    const roundedDown = Math.floor(totalAllItems / 10000) * 10000;
    const finalGrandTotal = roundedDown + roundedDown * 0.11;

    return {
        totalNonSbo,
        finalGrandTotal
    };
};

const resolveStatusTransition = (
    currentStatus: RabStatus,
    action: ApprovalActionInput
): RabStatus => {
    if (action.tindakan === "APPROVE") {
        if (action.jabatan === "KOORDINATOR") {
            if (currentStatus !== RAB_STATUS.WAITING_FOR_COORDINATOR) {
                throw new AppError(`Status saat ini ${currentStatus} tidak valid untuk approval koordinator`, 409);
            }
            return RAB_STATUS.WAITING_FOR_MANAGER;
        }

        if (action.jabatan === "MANAGER") {
            if (currentStatus !== RAB_STATUS.WAITING_FOR_MANAGER) {
                throw new AppError(`Status saat ini ${currentStatus} tidak valid untuk approval manager`, 409);
            }
            return RAB_STATUS.APPROVED;
        }

        if (currentStatus !== RAB_STATUS.APPROVED) {
            throw new AppError(`Status saat ini ${currentStatus} tidak valid untuk approval direktur`, 409);
        }

        return RAB_STATUS.APPROVED;
    }

    if (action.jabatan === "KOORDINATOR") {
        if (currentStatus !== RAB_STATUS.WAITING_FOR_COORDINATOR) {
            throw new AppError(`Status saat ini ${currentStatus} tidak valid untuk reject koordinator`, 409);
        }
        return RAB_STATUS.REJECTED_BY_COORDINATOR;
    }

    if (action.jabatan === "MANAGER") {
        if (currentStatus !== RAB_STATUS.WAITING_FOR_MANAGER) {
            throw new AppError(`Status saat ini ${currentStatus} tidak valid untuk reject manager`, 409);
        }
        return RAB_STATUS.REJECTED_BY_MANAGER;
    }

    if (currentStatus !== RAB_STATUS.APPROVED) {
        throw new AppError(`Status saat ini ${currentStatus} tidak valid untuk reject direktur`, 409);
    }

    return RAB_STATUS.REJECTED_BY_DIREKTUR;
};

export const rabService = {
    async submit(payload: SubmitRabInput) {
        const toko = await tokoRepository.findByNomorUlok(payload.nomor_ulok);
        if (!toko) {
            throw new AppError("Nomor ULOK tidak ditemukan di master toko", 404);
        }

        const isDuplicate = await rabRepository.existsActiveByUlokAndLingkup(
            payload.nomor_ulok,
            payload.lingkup_pekerjaan
        );

        if (isDuplicate) {
            throw new AppError(
                `RAB aktif untuk ULOK ${payload.nomor_ulok} dengan lingkup ${payload.lingkup_pekerjaan} sudah ada`,
                409
            );
        }

        const totals = computeTotals(payload.detail_items);

        return rabRepository.createWithDetails({
            ...payload,
            status: RAB_STATUS.WAITING_FOR_COORDINATOR,
            grand_total_nonsbo: totals.totalNonSbo,
            grand_total_final: totals.finalGrandTotal
        });
    },

    async list(query: RabListQuery) {
        return rabRepository.list(query);
    },

    async getById(id: string) {
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        return data;
    },

    async handleApproval(id: string, action: ApprovalActionInput) {
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const newStatus = resolveStatusTransition(data.pengajuan.status, action);

        await rabRepository.updateStatusAndInsertLog(id, newStatus, action);

        return {
            id,
            old_status: data.pengajuan.status,
            new_status: newStatus
        };
    },

    async generatePdf(id: string) {
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const toko = await tokoRepository.findByNomorUlok(data.pengajuan.nomor_ulok);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }

        const pdfBuffer = await buildRabPdfBuffer({
            pengajuan: data.pengajuan,
            detailItems: data.detailItems,
            tokoNama: toko.nama_toko,
            tokoAlamat: toko.alamat,
            tokoCabang: toko.cabang
        });

        const filename = `RAB_${data.pengajuan.nomor_ulok}_${data.pengajuan.id}.pdf`;
        return { filename, pdfBuffer };
    }
};
