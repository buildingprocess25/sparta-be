import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/pool";
import type { GanttStatus } from "./gantt.constants";
import type {
    DayGanttItemInput,
    DependencyItemInput,
    PengawasanItemInput
} from "./gantt.schema";

// ---------------------------------------------------------------------------
// Row types – sesuai tabel gantt_chart, kategori_pekerjaan_gantt, dll
// ---------------------------------------------------------------------------

export type GanttRow = {
    id: number;
    id_toko: number;
    status: string | null;
    email_pembuat: string | null;
    timestamp: string | null;
};

export type KategoriPekerjaanGanttRow = {
    id: number;
    id_gantt: number;
    kategori_pekerjaan: string;
};

export type DayGanttRow = {
    id: number;
    id_gantt: number;
    id_kategori_pekerjaan_gantt: number;
    h_awal: string | null;
    h_akhir: string | null;
    keterlambatan: string | null;
    kecepatan: string | null;
};

export type PengawasanGanttRow = {
    id: number;
    id_gantt: number;
    id_pic_pengawasan: number | null;
    tanggal_pengawasan: string;
};

export type DependencyGanttRow = {
    id: number;
    id_gantt: number;
    id_kategori: number;
    id_kategori_terikat: number;
};

export type TokoJoinRow = {
    id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    proyek: string | null;
    cabang: string | null;
    alamat: string | null;
    nama_kontraktor: string | null;
};

export type TokoStableFields = {
    kode_toko: string | null;
    alamat: string | null;
    nama_kontraktor: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GANTT_COLUMNS = `
    g.id, g.id_toko, g.status, g.email_pembuat, g.timestamp
`;

/**
 * Insert kategori pekerjaan dan return map nama -> id
 */
const insertKategoriPekerjaan = async (
    client: PoolClient,
    ganttId: number,
    kategoriList: string[]
): Promise<Map<string, number>> => {
    const kategoriMap = new Map<string, number>();
    for (const kategori of kategoriList) {
        const res = await client.query<{ id: number }>(
            `INSERT INTO kategori_pekerjaan_gantt (id_gantt, kategori_pekerjaan)
             VALUES ($1, $2)
             RETURNING id`,
            [ganttId, kategori]
        );
        kategoriMap.set(kategori, res.rows[0].id);
    }
    return kategoriMap;
};

/**
 * Insert day gantt chart items
 */
const insertDayItems = async (
    client: PoolClient,
    ganttId: number,
    dayItems: DayGanttItemInput[],
    kategoriMap: Map<string, number>
): Promise<void> => {
    for (const item of dayItems) {
        const kategoriId = kategoriMap.get(item.kategori_pekerjaan);
        if (!kategoriId) continue;

        await client.query(
            `INSERT INTO day_gantt_chart (
                id_gantt, id_kategori_pekerjaan_gantt,
                h_awal, h_akhir, keterlambatan, kecepatan
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                ganttId,
                kategoriId,
                item.h_awal,
                item.h_akhir,
                item.keterlambatan ?? null,
                item.kecepatan ?? null
            ]
        );
    }
};

/**
 * Insert pengawasan gantt items
 */
const insertPengawasan = async (
    client: PoolClient,
    ganttId: number,
    pengawasanItems: PengawasanItemInput[]
): Promise<void> => {
    for (const item of pengawasanItems) {
        await client.query(
            `INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
             VALUES ($1, $2)`,
            [ganttId, item.tanggal_pengawasan]
        );
    }
};

/**
 * Insert dependency gantt items
 */
const insertDependencies = async (
    client: PoolClient,
    ganttId: number,
    dependencies: DependencyItemInput[],
    kategoriMap: Map<string, number>
): Promise<void> => {
    for (const dep of dependencies) {
        const idKategori = kategoriMap.get(dep.kategori_pekerjaan);
        const idKategoriTerikat = kategoriMap.get(dep.kategori_pekerjaan_terikat);
        if (!idKategori || !idKategoriTerikat) continue;

        await client.query(
            `INSERT INTO dependency_gantt (id_gantt, id_kategori, id_kategori_terikat)
             VALUES ($1, $2, $3)`,
            [ganttId, idKategori, idKategoriTerikat]
        );
    }
};

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const ganttRepository = {
    async findLatestActiveByTokoId(tokoId: number): Promise<GanttRow | null> {
        const result = await pool.query<GanttRow>(
            `SELECT id, id_toko, status, email_pembuat, timestamp
             FROM gantt_chart
             WHERE id_toko = $1
               AND status = 'active'
             ORDER BY id DESC
             LIMIT 1`,
            [tokoId]
        );

        return result.rows[0] ?? null;
    },

    async updateTokoFieldsById(
        tokoId: number,
        payload: {
            lingkup_pekerjaan?: string | null;
            nama_toko?: string | null;
            kode_toko?: string | null;
            proyek?: string | null;
            cabang?: string | null;
            alamat?: string | null;
            nama_kontraktor?: string | null;
        }
    ): Promise<void> {
        await pool.query(
            `UPDATE toko
             SET lingkup_pekerjaan = COALESCE($1, lingkup_pekerjaan),
                 nama_toko = COALESCE($2, nama_toko),
                 kode_toko = COALESCE($3, kode_toko),
                 proyek = COALESCE($4, proyek),
                 cabang = COALESCE($5, cabang),
                 alamat = COALESCE($6, alamat),
                 nama_kontraktor = COALESCE($7, nama_kontraktor)
             WHERE id = $8`,
            [
                payload.lingkup_pekerjaan ?? null,
                payload.nama_toko ?? null,
                payload.kode_toko ?? null,
                payload.proyek ?? null,
                payload.cabang ?? null,
                payload.alamat ?? null,
                payload.nama_kontraktor ?? null,
                tokoId
            ]
        );
    },

    /** Cek gantt chart aktif berdasarkan toko id */
    async existsActiveByTokoId(tokoId: number): Promise<boolean> {
        const result = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS(
                SELECT 1 FROM gantt_chart
                WHERE id_toko = $1
                  AND status = 'active'
            )`,
            [tokoId]
        );
        return result.rows[0]?.exists ?? false;
    },

    /** Buat gantt chart lengkap: upsert toko + header + kategori + day + pengawasan + dependency */
    async createWithDetails(payload: {
        // toko
        nomor_ulok: string;
        lingkup_pekerjaan?: string | null;
        nama_toko?: string | null;
        kode_toko?: string | null;
        proyek?: string | null;
        cabang?: string | null;
        alamat?: string | null;
        nama_kontraktor?: string | null;
        // gantt
        email_pembuat: string;
        status: GanttStatus;
        // children
        kategori_pekerjaan: string[];
        day_items: DayGanttItemInput[];
        pengawasan?: PengawasanItemInput[];
        dependencies?: DependencyItemInput[];
    }): Promise<GanttRow & { toko_id: number }> {
        return withTransaction(async (client) => {
            // 1. Upsert toko by kombinasi nomor_ulok + lingkup_pekerjaan
            const existingTokoRes = await client.query<{ id: number }>(
                `SELECT id
                 FROM toko
                 WHERE nomor_ulok = $1
                   AND LOWER(COALESCE(lingkup_pekerjaan, '')) = LOWER(COALESCE($2, ''))
                 ORDER BY id DESC
                 LIMIT 1
                 FOR UPDATE`,
                [payload.nomor_ulok, payload.lingkup_pekerjaan ?? null]
            );

            let tokoId: number;
            if ((existingTokoRes.rowCount ?? 0) > 0) {
                tokoId = existingTokoRes.rows[0].id;

                await client.query(
                    `UPDATE toko
                     SET nama_toko = COALESCE($1, nama_toko),
                         kode_toko = COALESCE($2, kode_toko),
                         proyek = COALESCE($3, proyek),
                         cabang = COALESCE($4, cabang),
                         alamat = COALESCE($5, alamat),
                         nama_kontraktor = COALESCE($6, nama_kontraktor)
                     WHERE id = $7`,
                    [
                        payload.nama_toko ?? null,
                        payload.kode_toko ?? null,
                        payload.proyek ?? null,
                        payload.cabang ?? null,
                        payload.alamat ?? null,
                        payload.nama_kontraktor ?? null,
                        tokoId
                    ]
                );
            } else {
                const insertedTokoRes = await client.query<{ id: number }>(
                    `INSERT INTO toko (
                        nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko,
                        proyek, cabang, alamat, nama_kontraktor
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                    RETURNING id`,
                    [
                        payload.nomor_ulok,
                        payload.lingkup_pekerjaan ?? null,
                        payload.nama_toko ?? null,
                        payload.kode_toko ?? null,
                        payload.proyek ?? null,
                        payload.cabang ?? null,
                        payload.alamat ?? null,
                        payload.nama_kontraktor ?? null
                    ]
                );

                tokoId = insertedTokoRes.rows[0].id;
            }

            // 2. Insert gantt_chart header
            const ganttRes = await client.query<GanttRow>(
                `INSERT INTO gantt_chart (id_toko, status, email_pembuat, timestamp)
                 VALUES ($1, $2, $3, CURRENT_DATE)
                 RETURNING *`,
                [tokoId, payload.status, payload.email_pembuat]
            );
            const gantt = ganttRes.rows[0];

            // 3. Insert kategori pekerjaan
            const kategoriMap = await insertKategoriPekerjaan(
                client,
                gantt.id,
                payload.kategori_pekerjaan
            );

            // 4. Insert day gantt chart items
            await insertDayItems(client, gantt.id, payload.day_items, kategoriMap);

            // 5. Insert pengawasan (if any)
            if (payload.pengawasan && payload.pengawasan.length > 0) {
                await insertPengawasan(client, gantt.id, payload.pengawasan);
            }

            // 6. Insert dependencies (if any)
            if (payload.dependencies && payload.dependencies.length > 0) {
                await insertDependencies(client, gantt.id, payload.dependencies, kategoriMap);
            }

            return { ...gantt, toko_id: tokoId };
        });
    },

    /** Ambil gantt chart lengkap: header + toko + kategori + day + pengawasan + dependency */
    async findById(id: string, idToko?: number): Promise<{
        gantt: GanttRow;
        toko: TokoJoinRow;
        kategori_pekerjaan: KategoriPekerjaanGanttRow[];
        day_items: (DayGanttRow & { kategori_pekerjaan: string })[];
        pengawasan: PengawasanGanttRow[];
        dependencies: (DependencyGanttRow & {
            kategori_pekerjaan: string;
            kategori_pekerjaan_terikat: string;
        })[];
    } | null> {
        // Header + toko
        const headerConditions = ["g.id = $1"];
        const headerValues: unknown[] = [id];

        if (idToko !== undefined) {
            headerValues.push(idToko);
            headerConditions.push(`g.id_toko = $${headerValues.length}`);
        }

        const header = await pool.query<GanttRow & TokoJoinRow>(
            `SELECT ${GANTT_COLUMNS},
                t.id AS toko_id, t.nomor_ulok, t.lingkup_pekerjaan,
                t.nama_toko, t.kode_toko, t.proyek, t.cabang, t.alamat, t.nama_kontraktor
            FROM gantt_chart g
            JOIN toko t ON t.id = g.id_toko
            WHERE ${headerConditions.join(" AND ")}`,
            headerValues
        );

        if (header.rowCount === 0) return null;
        const row = header.rows[0];

        // Kategori pekerjaan
        const kategoriRes = await pool.query<KategoriPekerjaanGanttRow>(
            `SELECT id, id_gantt, kategori_pekerjaan
             FROM kategori_pekerjaan_gantt
             WHERE id_gantt = $1
             ORDER BY id ASC`,
            [id]
        );

        // Day items joined with kategori
        const dayRes = await pool.query<DayGanttRow & { kategori_pekerjaan: string }>(
            `SELECT d.id, d.id_gantt, d.id_kategori_pekerjaan_gantt,
                    d.h_awal, d.h_akhir, d.keterlambatan, d.kecepatan,
                    k.kategori_pekerjaan
             FROM day_gantt_chart d
             JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
             WHERE d.id_gantt = $1
             ORDER BY d.id ASC`,
            [id]
        );

        // Pengawasan
        const pengawasanRes = await pool.query<PengawasanGanttRow>(
            `SELECT id, id_gantt, id_pic_pengawasan, tanggal_pengawasan
             FROM pengawasan_gantt
             WHERE id_gantt = $1
             ORDER BY id ASC`,
            [id]
        );

        // Dependencies joined with kategori names
        const depRes = await pool.query<
            DependencyGanttRow & {
                kategori_pekerjaan: string;
                kategori_pekerjaan_terikat: string;
            }
        >(
            `SELECT dep.id, dep.id_gantt, dep.id_kategori, dep.id_kategori_terikat,
                    k1.kategori_pekerjaan AS kategori_pekerjaan,
                    k2.kategori_pekerjaan AS kategori_pekerjaan_terikat
             FROM dependency_gantt dep
             JOIN kategori_pekerjaan_gantt k1 ON k1.id = dep.id_kategori
             JOIN kategori_pekerjaan_gantt k2 ON k2.id = dep.id_kategori_terikat
             WHERE dep.id_gantt = $1
             ORDER BY dep.id ASC`,
            [id]
        );

        const gantt: GanttRow = {
            id: row.id,
            id_toko: row.id_toko,
            status: row.status,
            email_pembuat: row.email_pembuat,
            timestamp: row.timestamp
        };

        const toko: TokoJoinRow = {
            id: (row as any).toko_id,
            nomor_ulok: row.nomor_ulok,
            lingkup_pekerjaan: row.lingkup_pekerjaan,
            nama_toko: row.nama_toko,
            kode_toko: row.kode_toko,
            proyek: row.proyek,
            cabang: row.cabang,
            alamat: row.alamat,
            nama_kontraktor: row.nama_kontraktor
        };

        return {
            gantt,
            toko,
            kategori_pekerjaan: kategoriRes.rows,
            day_items: dayRes.rows,
            pengawasan: pengawasanRes.rows,
            dependencies: depRes.rows
        };
    },

    /** List gantt chart dengan filter */
    async list(filter: {
        status?: string;
        nomor_ulok?: string;
        email_pembuat?: string;
    }): Promise<
        (GanttRow & {
            nomor_ulok: string;
            nama_toko: string | null;
            cabang: string | null;
            proyek: string | null;
        })[]
    > {
        const conditions: string[] = [];
        const values: unknown[] = [];

        if (filter.status) {
            values.push(filter.status);
            conditions.push(`g.status = $${values.length}`);
        }

        if (filter.nomor_ulok) {
            values.push(filter.nomor_ulok);
            conditions.push(`t.nomor_ulok = $${values.length}`);
        }

        if (filter.email_pembuat) {
            values.push(filter.email_pembuat);
            conditions.push(`g.email_pembuat = $${values.length}`);
        }

        const whereClause =
            conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query(
            `SELECT ${GANTT_COLUMNS},
                t.nomor_ulok, t.nama_toko, t.cabang, t.proyek
             FROM gantt_chart g
             JOIN toko t ON t.id = g.id_toko
             ${whereClause}
             ORDER BY g.timestamp DESC`,
            values
        );

        return result.rows;
    },

    /** Update status gantt chart -> terkunci */
    async updateStatus(ganttId: string, newStatus: GanttStatus): Promise<void> {
        await pool.query(
            `UPDATE gantt_chart SET status = $1 WHERE id = $2`,
            [newStatus, ganttId]
        );
    },

    /** Aktifkan gantt chart terbaru berdasarkan toko */
    async activateLatestByTokoId(tokoId: number): Promise<boolean> {
        const result = await pool.query(
            `UPDATE gantt_chart
             SET status = 'active'
             WHERE id = (
                SELECT id
                FROM gantt_chart
                WHERE id_toko = $1
                ORDER BY id DESC
                LIMIT 1
             )`,
            [tokoId]
        );

        return (result.rowCount ?? 0) > 0;
    },

    /**
     * Pulihkan kolom toko yang wajib stabil setelah proses lock gantt chart.
     * Ini menjadi guard jika ada side-effect trigger saat update status gantt.
     */
    async restoreTokoStableFieldsByGanttId(ganttId: string, fields: TokoStableFields): Promise<void> {
        await pool.query(
            `UPDATE toko t
             SET kode_toko = $1,
                 alamat = $2,
                 nama_kontraktor = $3
             FROM gantt_chart g
             WHERE g.id = $4
               AND t.id = g.id_toko`,
            [fields.kode_toko, fields.alamat, fields.nama_kontraktor, ganttId]
        );
    },

    /** Update gantt chart (replace children data) */
    async updateWithDetails(
        ganttId: string,
        payload: {
            kategori_pekerjaan?: string[];
            day_items?: DayGanttItemInput[];
            pengawasan?: PengawasanItemInput[];
            dependencies?: DependencyItemInput[];
        }
    ): Promise<void> {
        return withTransaction(async (client) => {
            // Jika ada kategori_pekerjaan baru, hapus children lama lalu insert ulang
            if (payload.kategori_pekerjaan && payload.day_items) {
                // Hapus dependency dulu (FK ke kategori)
                await client.query(
                    `DELETE FROM dependency_gantt WHERE id_gantt = $1`,
                    [ganttId]
                );
                // Hapus day items (FK ke kategori)
                await client.query(
                    `DELETE FROM day_gantt_chart WHERE id_gantt = $1`,
                    [ganttId]
                );
                // Hapus kategori
                await client.query(
                    `DELETE FROM kategori_pekerjaan_gantt WHERE id_gantt = $1`,
                    [ganttId]
                );

                // Insert ulang kategori
                const ganttIdNum = Number(ganttId);
                const kategoriMap = await insertKategoriPekerjaan(
                    client,
                    ganttIdNum,
                    payload.kategori_pekerjaan
                );

                // Insert ulang day items
                await insertDayItems(
                    client,
                    ganttIdNum,
                    payload.day_items,
                    kategoriMap
                );

                // Insert ulang dependencies
                if (payload.dependencies && payload.dependencies.length > 0) {
                    await insertDependencies(
                        client,
                        ganttIdNum,
                        payload.dependencies,
                        kategoriMap
                    );
                }
            }

            // Update pengawasan jika ada
            if (payload.pengawasan) {
                await client.query(
                    `DELETE FROM pengawasan_gantt WHERE id_gantt = $1`,
                    [ganttId]
                );
                if (payload.pengawasan.length > 0) {
                    await insertPengawasan(
                        client,
                        Number(ganttId),
                        payload.pengawasan
                    );
                }
            }
        });
    },

    /** Hapus gantt chart beserta semua children (cascade) */
    async deleteById(id: string): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM gantt_chart WHERE id = $1`,
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    },

    /** Ambil status gantt chart by id */
    async findStatusById(id: string): Promise<string | null> {
        const result = await pool.query<{ status: string }>(
            `SELECT status FROM gantt_chart WHERE id = $1`,
            [id]
        );
        return result.rows[0]?.status ?? null;
    },

    /** Ambil mapping kategori_pekerjaan -> id untuk gantt tertentu */
    async getKategoriMap(ganttId: string): Promise<Map<string, number>> {
        const result = await pool.query<{ id: number; kategori_pekerjaan: string }>(
            `SELECT id, kategori_pekerjaan FROM kategori_pekerjaan_gantt WHERE id_gantt = $1`,
            [ganttId]
        );
        const map = new Map<string, number>();
        for (const row of result.rows) {
            map.set(row.kategori_pekerjaan, row.id);
        }
        return map;
    },

    /** Tambah day items ke gantt existing */
    async addDayItems(
        ganttId: string,
        dayItems: DayGanttItemInput[]
    ): Promise<number> {
        const kategoriMap = await this.getKategoriMap(ganttId);
        let inserted = 0;

        for (const item of dayItems) {
            const kategoriId = kategoriMap.get(item.kategori_pekerjaan);
            if (!kategoriId) continue;

            await pool.query(
                `INSERT INTO day_gantt_chart
                    (id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    ganttId,
                    kategoriId,
                    item.h_awal,
                    item.h_akhir,
                    item.keterlambatan ?? null,
                    item.kecepatan ?? null
                ]
            );
            inserted++;
        }

        return inserted;
    },

    /** Update keterlambatan semua day item pada kategori tertentu */
    async updateKeterlambatan(
        ganttId: string,
        kategoriPekerjaan: string,
        keterlambatan: string
    ): Promise<{ day_ids: number[] } | null> {
        const result = await pool.query<{ id: number }>(
            `UPDATE day_gantt_chart d
             SET keterlambatan = $1
             FROM kategori_pekerjaan_gantt k
             WHERE d.id_kategori_pekerjaan_gantt = k.id
               AND d.id_gantt = $2
               AND k.id_gantt = $2
               AND k.kategori_pekerjaan = $3
             RETURNING d.id`,
            [keterlambatan, ganttId, kategoriPekerjaan]
        );

        if (result.rowCount === 0) return null;
        return { day_ids: result.rows.map((row: { id: number }) => row.id) };
    },

    /** Update kecepatan pada day item tertentu */
    async updateKecepatan(
        ganttId: string,
        kategoriPekerjaan: string,
        hAwal: string,
        hAkhir: string,
        kecepatan: string
    ): Promise<{ day_id: number } | null> {
        const result = await pool.query<{ id: number }>(
            `UPDATE day_gantt_chart d
             SET kecepatan = $1
             FROM kategori_pekerjaan_gantt k
             WHERE d.id_kategori_pekerjaan_gantt = k.id
               AND d.id_gantt = $2
               AND k.kategori_pekerjaan = $3
               AND d.h_awal = $4
               AND d.h_akhir = $5
             RETURNING d.id`,
            [kecepatan, ganttId, kategoriPekerjaan, hAwal, hAkhir]
        );

        if (result.rowCount === 0) return null;
        return { day_id: result.rows[0].id };
    },

    /** Tambah pengawasan (single/bulk) */
    async addPengawasan(
        ganttId: string,
        tanggalPengawasanList: string[],
        idPicPengawasan?: number
    ): Promise<{ inserted: number; ids: number[] }> {
        const ids: number[] = [];

        for (const tanggalPengawasan of tanggalPengawasanList) {
            const result = await pool.query<{ id: number }>(
                `INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan, id_pic_pengawasan)
                 VALUES ($1, $2, $3) RETURNING id`,
                [ganttId, tanggalPengawasan, idPicPengawasan ?? null]
            );
            ids.push(result.rows[0].id);
        }

        return { inserted: ids.length, ids };
    },

    /** Hapus pengawasan berdasarkan tanggal pengawasan */
    async removePengawasan(
        ganttId: string,
        tanggalPengawasan: string
    ): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM pengawasan_gantt
             WHERE id_gantt = $1 AND tanggal_pengawasan = $2`,
            [ganttId, tanggalPengawasan]
        );
        return (result.rowCount ?? 0) > 0;
    },

    /**
     * Detail Gantt Chart berdasarkan id_toko.
     * - Ambil RAB terbaru → rab_item → unique kategori_pekerjaan (filtered_categories)
     * - Ambil gantt_chart terbaru + children (kategori, day, pengawasan, dependency)
     */
    async findDetailByTokoId(tokoId: number): Promise<{
        toko: TokoJoinRow;
        rab: { id: number; status: string | null } | null;
        filtered_categories: string[];
        gantt: GanttRow | null;
        kategori_pekerjaan: KategoriPekerjaanGanttRow[];
        day_items: (DayGanttRow & { kategori_pekerjaan: string })[];
        pengawasan: PengawasanGanttRow[];
        dependencies: (DependencyGanttRow & {
            kategori_pekerjaan: string;
            kategori_pekerjaan_terikat: string;
        })[];
    } | null> {
        // 1. Cek toko exists
        const tokoRes = await pool.query<TokoJoinRow>(
            `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko,
                    proyek, cabang, alamat, nama_kontraktor
             FROM toko WHERE id = $1`,
            [tokoId]
        );
        if (tokoRes.rowCount === 0) return null;
        const toko = tokoRes.rows[0];

        // 2. Ambil RAB terbaru untuk toko ini
        const rabRes = await pool.query<{ id: number; status: string | null }>(
            `SELECT id, status FROM rab WHERE id_toko = $1 ORDER BY id DESC LIMIT 1`,
            [tokoId]
        );
        const rab = rabRes.rows[0] ?? null;

        // 3. Ambil unique kategori_pekerjaan dari rab_item (filtered)
        let filteredCategories: string[] = [];
        if (rab) {
            const catRes = await pool.query<{ kategori_pekerjaan: string }>(
                `SELECT DISTINCT kategori_pekerjaan
                 FROM rab_item
                 WHERE id_rab = $1
                 ORDER BY kategori_pekerjaan ASC`,
                [rab.id]
            );
            filteredCategories = catRes.rows.map(
                (r: { kategori_pekerjaan: string }) => r.kategori_pekerjaan
            );
        }

        // 4. Ambil gantt_chart terbaru untuk toko ini
        const ganttRes = await pool.query<GanttRow>(
            `SELECT id, id_toko, status, email_pembuat, timestamp
             FROM gantt_chart
             WHERE id_toko = $1
             ORDER BY id DESC LIMIT 1`,
            [tokoId]
        );
        const gantt = ganttRes.rows[0] ?? null;

        if (!gantt) {
            return {
                toko,
                rab,
                filtered_categories: filteredCategories,
                gantt: null,
                kategori_pekerjaan: [],
                day_items: [],
                pengawasan: [],
                dependencies: []
            };
        }

        // 5. Kategori pekerjaan gantt
        const kategoriRes = await pool.query<KategoriPekerjaanGanttRow>(
            `SELECT id, id_gantt, kategori_pekerjaan
             FROM kategori_pekerjaan_gantt
             WHERE id_gantt = $1
             ORDER BY id ASC`,
            [gantt.id]
        );

        // 6. Day items
        const dayRes = await pool.query<DayGanttRow & { kategori_pekerjaan: string }>(
            `SELECT d.id, d.id_gantt, d.id_kategori_pekerjaan_gantt,
                    d.h_awal, d.h_akhir, d.keterlambatan, d.kecepatan,
                    k.kategori_pekerjaan
             FROM day_gantt_chart d
             JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
             WHERE d.id_gantt = $1
             ORDER BY d.id ASC`,
            [gantt.id]
        );

        // 7. Pengawasan
        const pengawasanRes = await pool.query<PengawasanGanttRow>(
            `SELECT id, id_gantt, id_pic_pengawasan, tanggal_pengawasan
             FROM pengawasan_gantt
             WHERE id_gantt = $1
             ORDER BY id ASC`,
            [gantt.id]
        );

        // 8. Dependencies
        const depRes = await pool.query<
            DependencyGanttRow & {
                kategori_pekerjaan: string;
                kategori_pekerjaan_terikat: string;
            }
        >(
            `SELECT dep.id, dep.id_gantt, dep.id_kategori, dep.id_kategori_terikat,
                    k1.kategori_pekerjaan AS kategori_pekerjaan,
                    k2.kategori_pekerjaan AS kategori_pekerjaan_terikat
             FROM dependency_gantt dep
             JOIN kategori_pekerjaan_gantt k1 ON k1.id = dep.id_kategori
             JOIN kategori_pekerjaan_gantt k2 ON k2.id = dep.id_kategori_terikat
             WHERE dep.id_gantt = $1
             ORDER BY dep.id ASC`,
            [gantt.id]
        );

        return {
            toko,
            rab,
            filtered_categories: filteredCategories,
            gantt,
            kategori_pekerjaan: kategoriRes.rows,
            day_items: dayRes.rows,
            pengawasan: pengawasanRes.rows,
            dependencies: depRes.rows
        };
    }
};
