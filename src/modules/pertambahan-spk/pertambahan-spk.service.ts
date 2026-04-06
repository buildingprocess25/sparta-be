import { AppError } from "../../common/app-error";
import { spkRepository } from "../spk/spk.repository";
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

async function ensureSpkExists(idSpk: number): Promise<void> {
    const spk = await spkRepository.findById(String(idSpk));
    if (!spk) {
        throw new AppError("SPK tidak ditemukan", 404);
    }
}

export const pertambahanSpkService = {
    async create(payload: CreatePertambahanSpkInput): Promise<PertambahanSpkDetailRow> {
        await ensureSpkExists(payload.id_spk);
        const created = await pertambahanSpkRepository.create(payload);

        const data = await pertambahanSpkRepository.findById(created.id);
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
