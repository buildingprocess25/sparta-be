import { AppError } from "../../common/app-error";
import { tokoRepository } from "../toko/toko.repository";
import { GANTT_STATUS } from "./gantt.constants";
import { ganttRepository } from "./gantt.repository";
import type {
    AddDayItemsInput,
    DayGanttItemInput,
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

const normalizeUpdateDayItems = (dayItems?: UpdateGanttInput["day_items"]): DayGanttItemInput[] | undefined => {
    if (!dayItems) return undefined;

    return dayItems.map((item: NonNullable<UpdateGanttInput["day_items"]>[number], index: number) => {
        if (!item.h_awal || !item.h_akhir) {
            throw new AppError(
                `day_items[${index}] wajib memiliki h_awal dan h_akhir`,
                400
            );
        }

        return {
            kategori_pekerjaan: item.kategori_pekerjaan,
            h_awal: item.h_awal,
            h_akhir: item.h_akhir,
            keterlambatan: item.keterlambatan,
            kecepatan: item.kecepatan,
        };
    });
};

const normalizeUpdateKategoriPekerjaan = (
    kategori?: UpdateGanttInput["kategori_pekerjaan"]
): string[] | undefined => {
    if (!kategori || kategori.length === 0) return undefined;
    return kategori;
};

const deriveKategoriPekerjaanFromDayItems = (
    dayItems?: DayGanttItemInput[]
): string[] | undefined => {
    if (!dayItems || dayItems.length === 0) return undefined;

    const uniqueKategori = Array.from(
        new Set(
            dayItems
                .map((item) => item.kategori_pekerjaan)
                .filter((value): value is string => Boolean(value && value.trim()))
        )
    );

    return uniqueKategori.length > 0 ? uniqueKategori : undefined;
};

const normalizeUpdatePengawasan = (
    pengawasan?: UpdateGanttInput["pengawasan"]
): UpdateGanttInput["pengawasan"] | undefined => {
    if (!pengawasan || pengawasan.length === 0) return undefined;
    return pengawasan;
};

export const ganttService = {
    async submit(payload: SubmitGanttInput) {
        // 1. Jika sudah ada gantt aktif untuk ULOK ini, lakukan replace data (bukan create baru)
        const existingToko = await tokoRepository.findByNomorUlok(payload.nomor_ulok);
        if (existingToko) {
            const activeGantt = await ganttRepository.findLatestActiveByTokoId(existingToko.id);
            if (activeGantt) {
                await ganttRepository.updateTokoFieldsById(existingToko.id, {
                    lingkup_pekerjaan: payload.lingkup_pekerjaan,
                    nama_toko: payload.nama_toko,
                    kode_toko: payload.kode_toko,
                    proyek: payload.proyek,
                    cabang: payload.cabang,
                    alamat: payload.alamat,
                    nama_kontraktor: payload.nama_kontraktor,
                });

                await ganttRepository.updateWithDetails(String(activeGantt.id), {
                    kategori_pekerjaan: payload.kategori_pekerjaan,
                    day_items: payload.day_items,
                    pengawasan: payload.pengawasan,
                    dependencies: payload.dependencies,
                });

                const refreshed = await ganttRepository.findById(String(activeGantt.id));
                if (!refreshed) {
                    throw new AppError("Gantt Chart tidak ditemukan setelah update", 500);
                }

                return {
                    ...refreshed.gantt,
                    toko_id: refreshed.gantt.id_toko,
                };
            }
        }

        // 2. Jika belum ada gantt aktif, buat data baru
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

    async getById(id: string, idToko?: number) {
        const data = await ganttRepository.findById(id, idToko);
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

        const normalizedDayItems = normalizeUpdateDayItems(payload.day_items);
        const normalizedKategoriPekerjaan =
            normalizeUpdateKategoriPekerjaan(payload.kategori_pekerjaan)
            ?? deriveKategoriPekerjaanFromDayItems(normalizedDayItems);
        const normalizedPengawasan = normalizeUpdatePengawasan(payload.pengawasan);

        const shouldReplaceMainData = Boolean(
            normalizedKategoriPekerjaan
            && normalizedDayItems
            && normalizedKategoriPekerjaan.length > 0
            && normalizedDayItems.length > 0
        );

        await ganttRepository.updateWithDetails(id, {
            kategori_pekerjaan: shouldReplaceMainData ? normalizedKategoriPekerjaan : undefined,
            day_items: shouldReplaceMainData ? normalizedDayItems : undefined,
            pengawasan: normalizedPengawasan,
            dependencies: payload.dependencies
        });

        return ganttRepository.findById(id);
    },

    async lock(id: string, email: string) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        const tokoStableFields = {
            kode_toko: data.toko.kode_toko,
            alamat: data.toko.alamat,
            nama_kontraktor: data.toko.nama_kontraktor,
        };

        if (data.gantt.status === GANTT_STATUS.TERKUNCI) {
            throw new AppError("Gantt Chart sudah terkunci", 409);
        }

        try {
            await ganttRepository.updateStatus(id, GANTT_STATUS.TERKUNCI);
        } finally {
            await ganttRepository.restoreTokoStableFieldsByGanttId(id, tokoStableFields);
        }

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

        const updates = payload.updates && payload.updates.length > 0
            ? payload.updates
            : payload.kategori_pekerjaan !== undefined && payload.keterlambatan !== undefined
                ? [{
                    kategori_pekerjaan: payload.kategori_pekerjaan,
                    keterlambatan: payload.keterlambatan
                }]
                : [];

        if (updates.length === 0) {
            throw new AppError(
                "Payload tidak valid, isi 'updates' atau 'kategori_pekerjaan' + 'keterlambatan'",
                400
            );
        }

        const updatedCategories: Array<{
            kategori_pekerjaan: string;
            keterlambatan: string;
            day_ids: number[];
        }> = [];
        const notFoundCategories: string[] = [];

        for (const item of updates) {
            const result = await ganttRepository.updateKeterlambatan(
                id,
                item.kategori_pekerjaan,
                item.keterlambatan
            );

            if (!result) {
                notFoundCategories.push(item.kategori_pekerjaan);
                continue;
            }

            updatedCategories.push({
                kategori_pekerjaan: item.kategori_pekerjaan,
                keterlambatan: item.keterlambatan,
                day_ids: result.day_ids
            });
        }

        if (updatedCategories.length === 0) {
            throw new AppError("Kategori pekerjaan tidak ditemukan pada gantt ini", 404);
        }

        return {
            total_rows_updated: updatedCategories.reduce(
                (sum, item) => sum + item.day_ids.length,
                0
            ),
            updated_categories: updatedCategories,
            not_found_categories: notFoundCategories
        };
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

        if (payload.tanggal_pengawasan) {
            const tanggalList = Array.isArray(payload.tanggal_pengawasan)
                ? payload.tanggal_pengawasan
                : [payload.tanggal_pengawasan];

            const result = await ganttRepository.addPengawasan(id, tanggalList);
            return {
                action: "added" as const,
                inserted: result.inserted,
                ids: result.ids
            };
        }

        if (payload.remove_tanggal_pengawasan) {
            await ganttRepository.removePengawasan(id, payload.remove_tanggal_pengawasan);
            return { action: "removed" as const };
        }

        throw new AppError(
            "Field 'tanggal_pengawasan' atau 'remove_tanggal_pengawasan' wajib diisi",
            400
        );
    },

    async getDetailByTokoId(idToko: number) {
        const data = await ganttRepository.findDetailByTokoId(idToko);
        if (!data) {
            throw new AppError("Toko tidak ditemukan", 404);
        }
        return data;
    }
};
