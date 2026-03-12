import { AppError } from "../../common/app-error";
import { tokoRepository } from "../toko/toko.repository";
import { GANTT_STATUS } from "./gantt.constants";
import { ganttRepository } from "./gantt.repository";
import type {
    AddDayItemsInput,
    GanttListQuery,
    ManagePengawasanInput,
    SubmitGanttInput,
    UpdateGanttInput,
    UpdateKecepatanInput,
    UpdateKeterlambatanInput
} from "./gantt.schema";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const ganttService = {
    async submit(payload: SubmitGanttInput) {
        // 1. Cek duplikasi gantt aktif untuk nomor_ulok ini
        const existingToko = await tokoRepository.findByNomorUlok(payload.nomor_ulok);
        if (existingToko) {
            const isDuplicate = await ganttRepository.existsActiveByTokoId(existingToko.id);
            if (isDuplicate) {
                throw new AppError(
                    `Gantt Chart aktif untuk ULOK ${payload.nomor_ulok} sudah ada`,
                    409
                );
            }
        }

        // 2. Simpan ke DB (upsert toko + insert gantt + children dalam 1 transaksi)
        const gantt = await ganttRepository.createWithDetails({
            // toko fields
            nomor_ulok: payload.nomor_ulok,
            lingkup_pekerjaan: payload.lingkup_pekerjaan,
            nama_toko: payload.nama_toko,
            kode_toko: payload.kode_toko,
            proyek: payload.proyek,
            cabang: payload.cabang,
            alamat: payload.alamat,
            nama_kontraktor: payload.nama_kontraktor,
            // gantt fields
            email_pembuat: payload.email_pembuat,
            status: GANTT_STATUS.ACTIVE,
            // children
            kategori_pekerjaan: payload.kategori_pekerjaan,
            day_items: payload.day_items,
            pengawasan: payload.pengawasan,
            dependencies: payload.dependencies
        });

        return gantt;
    },

    async list(query: GanttListQuery) {
        return ganttRepository.list(query);
    },

    async getById(id: string) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }
        return data;
    },

    async update(id: string, payload: UpdateGanttInput) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        if (data.gantt.status === GANTT_STATUS.TERKUNCI) {
            throw new AppError("Gantt Chart sudah terkunci, tidak bisa diubah", 409);
        }

        await ganttRepository.updateWithDetails(id, {
            kategori_pekerjaan: payload.kategori_pekerjaan,
            day_items: payload.day_items,
            pengawasan: payload.pengawasan,
            dependencies: payload.dependencies
        });

        return ganttRepository.findById(id);
    },

    async lock(id: string, email: string) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        if (data.gantt.status === GANTT_STATUS.TERKUNCI) {
            throw new AppError("Gantt Chart sudah terkunci", 409);
        }

        await ganttRepository.updateStatus(id, GANTT_STATUS.TERKUNCI);

        return {
            id,
            old_status: data.gantt.status,
            new_status: GANTT_STATUS.TERKUNCI,
            locked_by: email
        };
    },

    async remove(id: string) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        if (data.gantt.status === GANTT_STATUS.TERKUNCI) {
            throw new AppError("Gantt Chart sudah terkunci, tidak bisa dihapus", 409);
        }

        await ganttRepository.deleteById(id);
        return { id, deleted: true };
    },

    async addDayItems(id: string, payload: AddDayItemsInput) {
        const status = await ganttRepository.findStatusById(id);
        if (status === null) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }
        if (status === GANTT_STATUS.TERKUNCI) {
            throw new AppError("Gantt Chart sudah terkunci", 409);
        }

        const inserted = await ganttRepository.addDayItems(id, payload.day_items);
        return { inserted };
    },

    async updateKeterlambatan(id: string, payload: UpdateKeterlambatanInput) {
        const status = await ganttRepository.findStatusById(id);
        if (status === null) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        const result = await ganttRepository.updateKeterlambatan(
            id,
            payload.kategori_pekerjaan,
            payload.h_awal,
            payload.h_akhir,
            payload.keterlambatan
        );

        if (!result) {
            throw new AppError("Day item tidak ditemukan untuk kombinasi tersebut", 404);
        }

        return { day_id: result.day_id, keterlambatan: payload.keterlambatan };
    },

    async updateKecepatan(id: string, payload: UpdateKecepatanInput) {
        const status = await ganttRepository.findStatusById(id);
        if (status === null) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        const result = await ganttRepository.updateKecepatan(
            id,
            payload.kategori_pekerjaan,
            payload.h_awal,
            payload.h_akhir,
            payload.kecepatan
        );

        if (!result) {
            throw new AppError("Day item tidak ditemukan untuk kombinasi tersebut", 404);
        }

        return { day_id: result.day_id, kecepatan: payload.kecepatan };
    },

    async managePengawasan(id: string, payload: ManagePengawasanInput) {
        const status = await ganttRepository.findStatusById(id);
        if (status === null) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        if (payload.kategori_pekerjaan) {
            const result = await ganttRepository.addPengawasan(id, payload.kategori_pekerjaan);
            return { action: "added" as const, id: result.id };
        }

        if (payload.remove_kategori) {
            await ganttRepository.removePengawasan(id, payload.remove_kategori);
            return { action: "removed" as const };
        }

        throw new AppError("Field 'kategori_pekerjaan' atau 'remove_kategori' wajib diisi", 400);
    }
};
