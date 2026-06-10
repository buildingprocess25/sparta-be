import { AppError } from "../../common/app-error";
import * as xlsx from "xlsx";
import { tokoRepository } from "../toko/toko.repository";
import { picPengawasanService } from "../pic-pengawasan/pic-pengawasan.service";
import { rabRepository } from "../rab/rab.repository";
import { activityLogRepository } from "../activity-log/activity-log.repository";
import { GANTT_STATUS } from "./gantt.constants";
import { ganttRepository } from "./gantt.repository";
import type {
    AddDayItemsInput,
    CreateGanttNoteInput,
    DayGanttItemInput,
    GanttInterventionInput,
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

const releaseRabApprovalAfterGantt = async (tokoId: number, source: string) => {
    const releasedCount = await rabRepository.releaseWaitingGanttByTokoId(tokoId);
    if (releasedCount > 0) {
        console.log(`[GANTT ${source}] RAB masuk antrean approval setelah Gantt tersedia`, {
            tokoId,
            releasedCount
        });
    }
};

export const ganttService = {
    async submit(payload: SubmitGanttInput) {
        // 1. Jika sudah ada gantt aktif untuk ULOK ini, lakukan replace data (bukan create baru)
        const existingToko = await tokoRepository.findByNomorUlokAndLingkup(
            payload.nomor_ulok,
            payload.lingkup_pekerjaan
        );
        if (existingToko) {
            const activeGantt = await ganttRepository.findLatestActiveByTokoId(existingToko.id);
            if (activeGantt) {
                await ganttRepository.updateTokoFieldsById(existingToko.id, {
                    lingkup_pekerjaan: payload.lingkup_pekerjaan,
                    nama_toko: payload.nama_toko,
                    kode_toko: payload.kode_toko,
                    proyek: payload.proyek,
                    cabang: payload.cabang,
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

                await releaseRabApprovalAfterGantt(existingToko.id, "SUBMIT");

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
            // gantt fields
            email_pembuat: payload.email_pembuat,
            status: GANTT_STATUS.ACTIVE,
            // children
            kategori_pekerjaan: payload.kategori_pekerjaan,
            day_items: payload.day_items,
            pengawasan: payload.pengawasan,
            dependencies: payload.dependencies
        });

        await releaseRabApprovalAfterGantt(gantt.toko_id, "SUBMIT");

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

    async listNotes(id: string) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        return ganttRepository.listNotes(id);
    },

    async createNote(id: string, payload: CreateGanttNoteInput) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        return ganttRepository.createNote(id, payload);
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
            dependencies: payload.dependencies,
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

        await releaseRabApprovalAfterGantt(data.gantt.id_toko, "LOCK");

        return {
            id,
            old_status: data.gantt.status,
            new_status: GANTT_STATUS.TERKUNCI,
            locked_by: email
        };
    },

    async intervene(id: string, action: GanttInterventionInput) {
        const data = await ganttRepository.findById(id);
        if (!data) {
            throw new AppError("Gantt Chart tidak ditemukan", 404);
        }

        if (data.gantt.status === action.target_status) {
            throw new AppError("Status Gantt Chart sudah sama dengan target intervensi", 409);
        }

        const tokoStableFields = {
            kode_toko: data.toko.kode_toko,
            alamat: data.toko.alamat,
            nama_kontraktor: data.toko.nama_kontraktor,
        };

        try {
            await ganttRepository.updateStatus(id, action.target_status);
        } finally {
            await ganttRepository.restoreTokoStableFieldsByGanttId(id, tokoStableFields);
        }

        if (action.target_status === GANTT_STATUS.TERKUNCI) {
            await releaseRabApprovalAfterGantt(data.gantt.id_toko, "INTERVENTION");
        }

        await activityLogRepository.insert({
            entity_type: "GANTT",
            entity_id: Number(id),
            actor_email: action.actor_email,
            actor_role: action.actor_role,
            action: "INTERVENTION",
            status_before: data.gantt.status,
            status_after: action.target_status,
            reason: action.alasan_intervensi,
            metadata: {
                id_toko: data.gantt.id_toko,
                nomor_ulok: data.toko.nomor_ulok,
                source: "super_human_intervention",
            },
        });

        return {
            id,
            old_status: data.gantt.status,
            new_status: action.target_status,
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

            let idPicPengawasan: number | undefined;
            if (payload.pic_pengawasan) {
                const pic = await picPengawasanService.create(payload.pic_pengawasan);
                idPicPengawasan = pic.id;
            }

            const result = await ganttRepository.addPengawasan(id, tanggalList, idPicPengawasan);
            return {
                action: "added" as const,
                inserted: result.inserted,
                ids: result.ids,
                id_pic_pengawasan: idPicPengawasan ?? null
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
    },

    async previewMigrationExcel(buffer: Buffer) {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json<any>(sheet, { defval: "" });

        if (!rows || rows.length === 0) {
            throw new AppError("File Excel kosong atau tidak valid", 400);
        }

        const groups: Record<string, any[]> = {};
        for (const row of rows) {
            const noUlok = String(row["Nomor Ulok"] || "").trim();
            const lingkup = String(row["Lingkup_Pekerjaan"] || "").trim();
            
            if (!noUlok) continue;

            const key = `${noUlok}__${lingkup}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(row);
        }

        let readyCount = 0;
        let skippedCount = 0;
        const details: Array<{ nomor_ulok: string, lingkup_pekerjaan: string, status: string }> = [];

        for (const key of Object.keys(groups)) {
            const groupRows = groups[key];
            const firstRow = groupRows[0];
            const noUlok = String(firstRow["Nomor Ulok"] || "").trim();
            const lingkup = String(firstRow["Lingkup_Pekerjaan"] || "").trim();

            const existingToko = await tokoRepository.findByNomorUlokAndLingkup(noUlok, lingkup);
            
            if (existingToko) {
                const activeGantt = await ganttRepository.findLatestActiveByTokoId(existingToko.id);
                if (activeGantt) {
                    skippedCount++;
                    details.push({ nomor_ulok: noUlok, lingkup_pekerjaan: lingkup, status: "Di-skip (Sudah ada Gantt)" });
                    continue;
                }
            }

            readyCount++;
            details.push({ nomor_ulok: noUlok, lingkup_pekerjaan: lingkup, status: "Siap Insert" });
        }

        return {
            total_groups: Object.keys(groups).length,
            ready_count: readyCount,
            skipped_count: skippedCount,
            details: details,
            total_rows: rows.length
        };
    },

    async commitMigrationExcel(buffer: Buffer, emailPembuat: string, limit?: number) {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json<any>(sheet, { defval: "", raw: false });

        if (!rows || rows.length === 0) {
            throw new AppError("File Excel kosong atau tidak valid", 400);
        }

        const groups: Record<string, any[]> = {};
        for (const row of rows) {
            const noUlok = String(row["Nomor Ulok"] || "").trim();
            const lingkup = String(row["Lingkup_Pekerjaan"] || "").trim();
            
            if (!noUlok) continue;

            const key = `${noUlok}__${lingkup}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(row);
        }

        const parseDateString = (val: any): string => {
            if (!val) return "";
            
            // Jika Excel merender sebagai number (serial date)
            if (typeof val === 'number') {
                const date = new Date((val - 25569) * 86400 * 1000);
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }

            let dateStr = String(val).trim();
            // Format umum: DD/MM/YYYY
            if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                if (parts.length === 3) {
                    let yyyy = parts[2];
                    if (yyyy.length === 2) yyyy = `20${yyyy}`;
                    return `${yyyy}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            // Format DD-MM-YYYY
            if (dateStr.includes("-")) {
                const parts = dateStr.split("-");
                if (parts.length === 3 && parts[0].length <= 2) {
                    let yyyy = parts[2];
                    if (yyyy.length === 2) yyyy = `20${yyyy}`;
                    return `${yyyy}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return dateStr;
        };

        let insertedCount = 0;
        let skippedCount = 0;

        for (const key of Object.keys(groups)) {
            // Apply limit if provided
            if (limit !== undefined && insertedCount >= limit) {
                break;
            }

            const groupRows = groups[key];
            const firstRow = groupRows[0];
            const noUlok = String(firstRow["Nomor Ulok"] || "").trim();
            const lingkup = String(firstRow["Lingkup_Pekerjaan"] || "").trim();

            const existingToko = await tokoRepository.findByNomorUlokAndLingkup(noUlok, lingkup);
            
            if (existingToko) {
                const activeGantt = await ganttRepository.findLatestActiveByTokoId(existingToko.id);
                if (activeGantt) {
                    skippedCount++;
                    continue;
                }
            }

            const dayItems: DayGanttItemInput[] = groupRows.map((row) => {
                return {
                    kategori_pekerjaan: String(row["Kategori"] || "").trim(),
                    h_awal: parseDateString(row["h_awal"]),
                    h_akhir: parseDateString(row["h_akhir"]),
                    keterlambatan: row["keterlambatan"] !== undefined && row["keterlambatan"] !== "" ? String(row["keterlambatan"]) : null,
                    kecepatan: row["kecepatan"] !== undefined && row["kecepatan"] !== "" ? String(row["kecepatan"]) : null,
                };
            }).filter(item => item.kategori_pekerjaan && item.h_awal && item.h_akhir);

            if (dayItems.length === 0) {
                skippedCount++;
                continue;
            }

            const uniqueKategori = Array.from(new Set(dayItems.map(d => d.kategori_pekerjaan)));

            const ganttData = await ganttRepository.createWithDetails({
                nomor_ulok: noUlok,
                lingkup_pekerjaan: lingkup,
                nama_toko: "",
                kode_toko: "",
                proyek: "",
                cabang: "",
                email_pembuat: emailPembuat,
                status: GANTT_STATUS.ACTIVE,
                kategori_pekerjaan: uniqueKategori,
                day_items: dayItems,
            });

            await releaseRabApprovalAfterGantt(ganttData.toko_id, "MIGRASI_SUPER_HUMAN");
            insertedCount++;
        }

        return {
            inserted_count: insertedCount,
            skipped_count: skippedCount,
            total_groups: Object.keys(groups).length,
            limit_applied: limit
        };
    }
};
