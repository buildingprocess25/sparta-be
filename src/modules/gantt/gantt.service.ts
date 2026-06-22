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

const normalizeKategoriKey = (value: string) =>
    value
        .trim()
        .replace(/\s*\/\s*/g, "/")
        .replace(/\s+/g, " ")
        .toUpperCase();

const appendUniqueKategori = (kategoriList: string[], kategori: string) => {
    const cleanKategori = kategori.trim();
    const key = normalizeKategoriKey(cleanKategori);
    if (!key) return;

    const exists = kategoriList.some((existing) => normalizeKategoriKey(existing) === key);
    if (!exists) kategoriList.push(cleanKategori);
};

const includeDependencyCategories = (
    kategoriList: string[],
    dependencies?: Array<{ kategori_pekerjaan: string; kategori_pekerjaan_terikat: string }>
) => {
    if (!dependencies) return;

    dependencies.forEach((dependency) => {
        appendUniqueKategori(kategoriList, dependency.kategori_pekerjaan);
        appendUniqueKategori(kategoriList, dependency.kategori_pekerjaan_terikat);
    });
};

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
    async getSupervisionWorkspace(nomorUlok: string) {
        const scopes = await ganttRepository.findSupervisionWorkspace(nomorUlok);
        if (scopes.length === 0) {
            throw new AppError("ULOK tidak ditemukan", 404);
        }

        return {
            nomor_ulok: nomorUlok,
            nama_toko: scopes[0]?.nama_toko ?? null,
            kode_toko: scopes[0]?.kode_toko ?? null,
            cabang: scopes[0]?.cabang ?? null,
            pic_bersama: scopes.find((scope) => scope.plc_building_support)?.plc_building_support ?? null,
            scopes,
            serah_terima_ready: scopes
                .filter((scope) => scope.gantt_id)
                .every((scope) =>
                    Boolean(scope.opname_final_id)
                    && ["terkunci"].includes(String(scope.opname_aksi ?? "").toLowerCase())
                    && ["Disetujui"].includes(String(scope.status_opname_final ?? ""))
                ),
            serah_terima_generated: scopes
                .filter((scope) => scope.gantt_id)
                .every((scope) => Boolean(scope.berkas_serah_terima_id)),
        };
    },
    async submit(payload: SubmitGanttInput) {
        const kategoriPekerjaan = [...payload.kategori_pekerjaan];
        includeDependencyCategories(kategoriPekerjaan, payload.dependencies);

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
                    kategori_pekerjaan: kategoriPekerjaan,
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
            kategori_pekerjaan: kategoriPekerjaan,
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
        if (normalizedKategoriPekerjaan) {
            includeDependencyCategories(normalizedKategoriPekerjaan, payload.dependencies);
        }
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

        const sheetGantt = workbook.Sheets['gantt_chart'] || workbook.Sheets[workbook.SheetNames[0]];
        const sheetDay   = workbook.Sheets['day_gantt_chart'];

        if (!sheetGantt) {
            throw new AppError("File Excel kosong atau sheet gantt_chart tidak ditemukan", 400);
        }

        const ganttRows = xlsx.utils.sheet_to_json<any>(sheetGantt, { defval: "", raw: false });
        const dayRows   = sheetDay ? xlsx.utils.sheet_to_json<any>(sheetDay, { defval: "", raw: false }) : [];

        if (!ganttRows || ganttRows.length === 0) {
            throw new AppError("Sheet gantt_chart kosong atau tidak valid", 400);
        }

        let readyCount   = 0;
        let skippedCount = 0;
        const details: Array<{ nomor_ulok: string; lingkup_pekerjaan: string; status: string; sheet_count?: number }> = [];

        for (const gRow of ganttRows) {
            const noUlok  = String(gRow["Nomor Ulok"]       || "").trim();
            const lingkup = String(gRow["Lingkup_Pekerjaan"] || "").trim();
            if (!noUlok) continue;

            // Hitung baris di day_gantt_chart yang cocok
            const dayCount = dayRows.filter(r =>
                String(r["Nomor Ulok"] || "").trim() === noUlok &&
                String(r["Lingkup_Pekerjaan"] || "").trim() === lingkup
            ).length;

            const existingToko = await tokoRepository.findByNomorUlokAndLingkup(noUlok, lingkup);
            if (existingToko) {
                const existingGantt = await ganttRepository.findLatestByTokoId(existingToko.id);
                if (existingGantt) {
                    skippedCount++;
                    details.push({ nomor_ulok: noUlok, lingkup_pekerjaan: lingkup, status: "Di-skip (Sudah ada Gantt)", sheet_count: dayCount });
                    continue;
                }
            }

            readyCount++;
            details.push({ nomor_ulok: noUlok, lingkup_pekerjaan: lingkup, status: "Siap Insert", sheet_count: dayCount });
        }

        return {
            total_groups:  ganttRows.length,
            ready_count:   readyCount,
            skipped_count: skippedCount,
            details,
            total_rows:    dayRows.length,
        };
    },

    async commitMigrationExcel(buffer: Buffer, emailPembuat: string, limit?: number) {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        
        // Baca 3 sheet yang saling berkaitan
        const sheetGantt = workbook.Sheets['gantt_chart'] || workbook.Sheets[workbook.SheetNames[0]];
        const sheetDay = workbook.Sheets['day_gantt_chart'];
        const sheetDep = workbook.Sheets['dependency_gantt'];

        if (!sheetGantt) {
            throw new AppError("File Excel kosong atau sheet gantt_chart tidak ditemukan", 400);
        }

        // Parse semua sheet sekaligus
        const ganttRows = xlsx.utils.sheet_to_json<any>(sheetGantt, { defval: "", raw: false });
        const dayRows  = sheetDay ? xlsx.utils.sheet_to_json<any>(sheetDay,  { defval: "", raw: false }) : [];
        const depRows  = sheetDep ? xlsx.utils.sheet_to_json<any>(sheetDep,  { defval: "", raw: false }) : [];

        if (!ganttRows || ganttRows.length === 0) {
            throw new AppError("Sheet gantt_chart kosong atau tidak valid", 400);
        }

        const parseDateString = (val: any): string => {
            if (!val) return "";
            if (typeof val === 'number') {
                const date = new Date((val - 25569) * 86400 * 1000);
                const yyyy = date.getFullYear();
                const mm   = String(date.getMonth() + 1).padStart(2, '0');
                const dd   = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
            let dateStr = String(val).trim();
            if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                if (parts.length === 3) {
                    let yyyy = parts[2];
                    if (yyyy.length === 2) yyyy = `20${yyyy}`;
                    return `${yyyy}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
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

        const isDatePattern = /^\d{4}-\d{2}-\d{2}$/;
        let insertedCount = 0;
        let skippedCount  = 0;

        for (const gRow of ganttRows) {
            if (limit !== undefined && insertedCount >= limit) break;

            const noUlok = String(gRow["Nomor Ulok"] || "").trim();
            const lingkup = String(gRow["Lingkup_Pekerjaan"] || "").trim();
            if (!noUlok) continue;

            // Cek duplikasi
            const existingToko = await tokoRepository.findByNomorUlokAndLingkup(noUlok, lingkup);
            if (existingToko) {
                const existingGantt = await ganttRepository.findLatestByTokoId(existingToko.id);
                if (existingGantt) { skippedCount++; continue; }
            }

            // ─── 1. Kategori Pekerjaan (dari kolom Kategori_1 … Kategori_30) ────────
            const kategoriPekerjaan: string[] = [];
            for (let i = 1; i <= 30; i++) {
                const kName = String(gRow[`Kategori_${i}`] || "").trim();
                appendUniqueKategori(kategoriPekerjaan, kName);
            }

            // ─── 2. Day Items (dari sheet day_gantt_chart) ────────────────────────────
            const groupDayRows = dayRows.filter(r =>
                String(r["Nomor Ulok"] || "").trim() === noUlok &&
                String(r["Lingkup_Pekerjaan"] || "").trim() === lingkup
            );

            const rawItems = groupDayRows.map(row => ({
                kategori_pekerjaan: String(row["Kategori"] || "").trim(),
                raw_h_awal: parseDateString(row["h_awal"]),
                raw_h_akhir: parseDateString(row["h_akhir"]),
                keterlambatan: (row["keterlambatan"] !== undefined && row["keterlambatan"] !== "") ? String(row["keterlambatan"]) : null,
                kecepatan:     (row["kecepatan"]     !== undefined && row["kecepatan"]     !== "") ? String(row["kecepatan"])     : null,
            })).filter(item => item.kategori_pekerjaan && item.raw_h_awal && item.raw_h_akhir);

            if (rawItems.length === 0) { skippedCount++; continue; }

            // Deteksi format: tanggal aktual vs indeks hari relatif
            const allAwalAreDates = rawItems.every(r => isDatePattern.test(r.raw_h_awal));
            let dayItems: DayGanttItemInput[] = [];
            let minDate: Date | null = null;

            if (allAwalAreDates) {
                minDate = rawItems.reduce<Date>((min, item) => {
                    const d = new Date(item.raw_h_awal);
                    return d < min ? d : min;
                }, new Date(rawItems[0].raw_h_awal));

                dayItems = rawItems.map(item => {
                    const diffAwal  = Math.floor((new Date(item.raw_h_awal).getTime() - minDate!.getTime()) / 86_400_000);
                    const diffAkhir = Math.floor((new Date(item.raw_h_akhir).getTime() - minDate!.getTime()) / 86_400_000);
                    return {
                        kategori_pekerjaan: item.kategori_pekerjaan,
                        h_awal:  String(diffAwal  + 1),
                        h_akhir: String(diffAkhir + 1),
                        keterlambatan: item.keterlambatan,
                        kecepatan:     item.kecepatan,
                    };
                });
            } else {
                dayItems = rawItems.map(item => ({
                    kategori_pekerjaan: item.kategori_pekerjaan,
                    h_awal:  item.raw_h_awal,
                    h_akhir: item.raw_h_akhir,
                    keterlambatan: item.keterlambatan,
                    kecepatan:     item.kecepatan,
                }));
            }

            // Tambahkan kategori yang muncul di day_items tapi belum ada di list
            dayItems.forEach(d => {
                appendUniqueKategori(kategoriPekerjaan, d.kategori_pekerjaan);
            });
            if (kategoriPekerjaan.length === 0) { skippedCount++; continue; }

            // Kolom Pengawasan_1 ... Pengawasan_20 pada sheet migrasi diabaikan.
            const pengawasanItems: { tanggal_pengawasan: string }[] = [];

            // ─── 4. Dependencies (dari sheet dependency_gantt) ───────────────────────
            const depItems: { kategori_pekerjaan: string; kategori_pekerjaan_terikat: string }[] = [];
            depRows
                .filter(r =>
                    String(r["Nomor Ulok"] || "").trim() === noUlok &&
                    String(r["Lingkup_Pekerjaan"] || "").trim() === lingkup
                )
                .forEach(r => {
                    const k1 = String(r["Kategori"] || "").trim();
                    const k2 = String(r["Kategori_Terikat"] || "").trim();
                    if (k1 && k2) depItems.push({ kategori_pekerjaan: k1, kategori_pekerjaan_terikat: k2 });
                });
            includeDependencyCategories(kategoriPekerjaan, depItems);

            // ─── 5. Simpan ke DB ─────────────────────────────────────────────────────
            const ganttData = await ganttRepository.createWithDetails({
                nomor_ulok:        noUlok,
                lingkup_pekerjaan: lingkup,
                nama_toko:         String(gRow["Nama_Toko"]       || "").trim() || "Data Toko",
                kode_toko:         String(gRow["Kode_Toko"]       || "").trim() || null,
                proyek:            String(gRow["Proyek"]          || "").trim() || null,
                cabang:            String(gRow["Cabang"]          || "").trim() || null,
                alamat:            String(gRow["Alamat"]          || "").trim() || null,
                nama_kontraktor:   String(gRow["Nama_Kontraktor"] || "").trim() || null,
                email_pembuat:     String(gRow["Email_Pembuat"]   || emailPembuat).trim(),
                gantt_timestamp:   (() => {
                    const ts = String(gRow["Timestamp"] || "").trim();
                    if (!ts) return null;
                    // Timestamp bisa berupa ISO string: "2025-12-29T11:18:39..."
                    const match = ts.match(/^(\d{4}-\d{2}-\d{2})/);
                    return match ? match[1] : null;
                })(),
                status: (() => {
                    const raw = String(gRow["Status"] || "").trim().toLowerCase();
                    if (raw === GANTT_STATUS.TERKUNCI) return GANTT_STATUS.TERKUNCI;
                    return GANTT_STATUS.ACTIVE;
                })(),
                kategori_pekerjaan: kategoriPekerjaan,
                day_items:          dayItems,
                pengawasan:         pengawasanItems,
                dependencies:       depItems,
            });

            await releaseRabApprovalAfterGantt(ganttData.toko_id, "MIGRASI_SUPER_HUMAN");
            insertedCount++;
        }

        return {
            inserted_count: insertedCount,
            skipped_count:  skippedCount,
            total_groups:   ganttRows.length,
            limit_applied:  limit,
        };
    }
};
