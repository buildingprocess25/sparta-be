import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/pool";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { ACTIVE_RAB_STATUSES, REJECTED_RAB_STATUSES, type RabStatus } from "./rab.constants";
import type { DetailItemInput } from "./rab.schema";

// ---------------------------------------------------------------------------
// Row types – sesuai tabel rab, rab_item, toko
// ---------------------------------------------------------------------------

export type RabRow = {
    id: number;
    id_toko: number;
    no_sph: number | null;
    status: RabStatus;
    nama_pt: string | null;
    email_pembuat: string | null;
    logo: string | null;
    link_pdf_gabungan: string | null;
    link_pdf_non_sbo: string | null;
    link_pdf_rekapitulasi: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    pemberi_persetujuan_direktur: string | null;
    nama_lengkap_persetujuan_direktur?: string | null;
    waktu_persetujuan_direktur: string | null;
    alasan_penolakan: string | null;
    waktu_penolakan: string | null;
    ditolak_oleh: string | null;
    durasi_pekerjaan: string | null;
    kategori_lokasi: string | null;
    no_polis: string | null;
    berlaku_polis: string | null;
    file_asuransi: string | null;
    luas_bangunan: string | null;
    luas_terbangun: string | null;
    luas_area_terbuka: string | null;
    luas_area_parkir: string | null;
    luas_area_sales: string | null;
    luas_gudang: string | null;
    grand_total: string | null;
    grand_total_non_sbo: string | null;
    grand_total_final: string | null;
    created_at: string;
};

export type RabItemRow = {
    id: number;
    id_rab: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: number;
    harga_material: number;
    harga_upah: number;
    total_material: number;
    total_upah: number;
    total_harga: number;
    catatan: string | null;
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

const RAB_COLUMNS = `
    r.id, r.id_toko, r.no_sph, r.status, r.nama_pt, r.email_pembuat, r.logo,
    r.link_pdf_gabungan, r.link_pdf_non_sbo, r.link_pdf_rekapitulasi,
    r.pemberi_persetujuan_koordinator, r.waktu_persetujuan_koordinator,
    r.pemberi_persetujuan_manager, r.waktu_persetujuan_manager,
    r.pemberi_persetujuan_direktur, r.waktu_persetujuan_direktur,
    r.alasan_penolakan, r.waktu_penolakan, r.ditolak_oleh, r.durasi_pekerjaan, r.kategori_lokasi,
    r.no_polis, r.berlaku_polis, r.file_asuransi,
    r.luas_bangunan, r.luas_terbangun, r.luas_area_terbuka,
    r.luas_area_parkir, r.luas_area_sales, r.luas_gudang,
    r.grand_total, r.grand_total_non_sbo, r.grand_total_final, r.created_at
`;

const insertRabItems = async (
    client: PoolClient,
    rabId: number,
    detailItems: DetailItemInput[]
): Promise<void> => {
    if (detailItems.length === 0) return;

    // Keep query size bounded for very large payloads.
    const chunkSize = 200;

    for (let start = 0; start < detailItems.length; start += chunkSize) {
        const chunk = detailItems.slice(start, start + chunkSize);
        const values: Array<string | number | null> = [];
        const placeholders: string[] = [];

        for (const item of chunk) {
            const totalMaterial = item.volume * item.harga_material;
            const totalUpah = item.volume * item.harga_upah;
            const totalHarga = totalMaterial + totalUpah;
            const catatan = item.catatan?.trim() || null;

            const base = values.length;
            placeholders.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`
            );

            values.push(
                rabId,
                item.kategori_pekerjaan,
                item.jenis_pekerjaan,
                item.satuan,
                item.volume,
                item.harga_material,
                item.harga_upah,
                totalMaterial,
                totalUpah,
                totalHarga,
                catatan
            );
        }

        await client.query(
            `INSERT INTO rab_item (
                id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan,
                volume, harga_material, harga_upah,
                total_material, total_upah, total_harga, catatan
            ) VALUES ${placeholders.join(", ")}`,
            values
        );
    }
};

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const rabRepository = {
    async findLatestByTokoId(tokoId: number): Promise<RabRow | null> {
        const result = await pool.query<RabRow>(
            `SELECT ${RAB_COLUMNS}
             FROM rab r
             WHERE r.id_toko = $1
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT 1`,
            [tokoId]
        );

        return result.rows[0] ?? null;
    },

    /** Cek RAB aktif berdasarkan nomor_ulok (lewat tabel toko) + lingkup */
    async existsActiveByTokoId(tokoId: number): Promise<boolean> {
        const result = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS(
                SELECT 1 FROM rab
                WHERE id_toko = $1
                  AND status = ANY($2::text[])
            )`,
            [tokoId, ACTIVE_RAB_STATUSES]
        );
        return result.rows[0]?.exists ?? false;
    },

    async replaceRejectedWithDetails(
        rabId: number,
        payload: {
            // toko fields
            nomor_ulok: string;
            lingkup_pekerjaan?: string;
            nama_toko?: string;
            proyek?: string;
            cabang?: string;
            alamat?: string;
            nama_kontraktor?: string;
            // rab fields
            email_pembuat: string;
            nama_pt: string;
            status: RabStatus;
            logo?: string;
            durasi_pekerjaan: string;
            kategori_lokasi?: string;
            no_polis?: string;
            berlaku_polis?: string;
            file_asuransi?: string;
            luas_bangunan?: string;
            luas_terbangun?: string;
            luas_area_terbuka?: string;
            luas_area_parkir?: string;
            luas_area_sales?: string;
            luas_gudang?: string;
            grand_total: string;
            grand_total_non_sbo: string;
            grand_total_final: string;
            detail_items: DetailItemInput[];
        }
    ): Promise<RabRow> {
        return withTransaction(async (client) => {
            const currentRes = await client.query<RabRow>(
                `SELECT * FROM rab WHERE id = $1 FOR UPDATE`,
                [rabId]
            );

            if ((currentRes.rowCount ?? 0) === 0) {
                throw new Error(`RAB dengan id ${rabId} tidak ditemukan`);
            }

            const currentRab = currentRes.rows[0];
            if (!REJECTED_RAB_STATUSES.includes(currentRab.status)) {
                throw new Error(`RAB dengan id ${rabId} tidak dalam status reject`);
            }

            await client.query(
                `UPDATE toko
                 SET lingkup_pekerjaan = COALESCE($1, lingkup_pekerjaan),
                     nama_toko = COALESCE($2, nama_toko),
                     proyek = COALESCE($3, proyek),
                     cabang = COALESCE($4, cabang),
                     alamat = COALESCE($5, alamat),
                     nama_kontraktor = COALESCE($6, nama_kontraktor)
                 WHERE id = $7`,
                [
                    payload.lingkup_pekerjaan ?? null,
                    payload.nama_toko ?? null,
                    payload.proyek ?? null,
                    payload.cabang ?? null,
                    payload.alamat ?? null,
                    payload.nama_kontraktor ?? null,
                    currentRab.id_toko
                ]
            );

            const updatedRabRes = await client.query<RabRow>(
                `UPDATE rab
                 SET status = $1,
                     nama_pt = $2,
                     email_pembuat = $3,
                     logo = COALESCE($4, logo),
                     durasi_pekerjaan = $5,
                     kategori_lokasi = $6,
                     no_polis = $7,
                     berlaku_polis = $8,
                     file_asuransi = COALESCE($9, file_asuransi),
                     luas_bangunan = $10,
                     luas_terbangun = $11,
                     luas_area_terbuka = $12,
                     luas_area_parkir = $13,
                     luas_area_sales = $14,
                     luas_gudang = $15,
                     grand_total = $16,
                     grand_total_non_sbo = $17,
                     grand_total_final = $18,
                     alasan_penolakan = NULL,
                     waktu_penolakan = NULL,
                     ditolak_oleh = NULL,
                     pemberi_persetujuan_direktur = NULL,
                     waktu_persetujuan_direktur = NULL,
                     pemberi_persetujuan_koordinator = NULL,
                     waktu_persetujuan_koordinator = NULL,
                     pemberi_persetujuan_manager = NULL,
                     waktu_persetujuan_manager = NULL,
                     created_at = timezone('Asia/Jakarta', now())
                 WHERE id = $19
                 RETURNING *`,
                [
                    payload.status,
                    payload.nama_pt,
                    payload.email_pembuat,
                    payload.logo ?? null,
                    payload.durasi_pekerjaan,
                    payload.kategori_lokasi ?? null,
                    payload.no_polis ?? null,
                    payload.berlaku_polis ?? null,
                    payload.file_asuransi ?? null,
                    payload.luas_bangunan ?? null,
                    payload.luas_terbangun ?? null,
                    payload.luas_area_terbuka ?? null,
                    payload.luas_area_parkir ?? null,
                    payload.luas_area_sales ?? null,
                    payload.luas_gudang ?? null,
                    payload.grand_total,
                    payload.grand_total_non_sbo,
                    payload.grand_total_final,
                    rabId
                ]
            );

            await client.query(`DELETE FROM rab_item WHERE id_rab = $1`, [rabId]);
            await insertRabItems(client, rabId, payload.detail_items);

            return updatedRabRes.rows[0];
        });
    },

    /** Upsert toko + buat RAB header + items dalam satu transaksi */
    async createWithDetails(payload: {
        // toko fields
        nomor_ulok: string;
        lingkup_pekerjaan?: string;
        nama_toko?: string;
        proyek?: string;
        cabang?: string;
        alamat?: string;
        nama_kontraktor?: string;
        // rab fields
        email_pembuat: string;
        nama_pt: string;
        status: RabStatus;
        logo?: string;
        durasi_pekerjaan: string;
        kategori_lokasi?: string;
        no_polis?: string;
        berlaku_polis?: string;
        file_asuransi?: string;
        luas_bangunan?: string;
        luas_terbangun?: string;
        luas_area_terbuka?: string;
        luas_area_parkir?: string;
        luas_area_sales?: string;
        luas_gudang?: string;
        grand_total: string;
        grand_total_non_sbo: string;
        grand_total_final: string;
        detail_items: DetailItemInput[];
    }): Promise<RabRow & { toko_id: number }> {
        return withTransaction(async (client) => {
            // 1. Upsert toko – insert atau update jika nomor_ulok sudah ada
            const tokoRes = await client.query<{ id: number }>(
                `INSERT INTO toko (
                    nomor_ulok, lingkup_pekerjaan, nama_toko,
                    proyek, cabang, alamat, nama_kontraktor
                ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                ON CONFLICT (nomor_ulok) DO UPDATE SET
                    lingkup_pekerjaan = COALESCE(EXCLUDED.lingkup_pekerjaan, toko.lingkup_pekerjaan),
                    nama_toko = COALESCE(EXCLUDED.nama_toko, toko.nama_toko),
                    proyek = COALESCE(EXCLUDED.proyek, toko.proyek),
                    cabang = COALESCE(EXCLUDED.cabang, toko.cabang),
                    alamat = COALESCE(EXCLUDED.alamat, toko.alamat),
                    nama_kontraktor = COALESCE(EXCLUDED.nama_kontraktor, toko.nama_kontraktor)
                RETURNING id`,
                [
                    payload.nomor_ulok,
                    payload.lingkup_pekerjaan ?? null,
                    payload.nama_toko ?? null,
                    payload.proyek ?? null,
                    payload.cabang ?? null,
                    payload.alamat ?? null,
                    payload.nama_kontraktor ?? null
                ]
            );
            const tokoId = tokoRes.rows[0].id;

            // 2. Insert RAB header
            const res = await client.query<RabRow>(
                `INSERT INTO rab (
                    id_toko, status, nama_pt, email_pembuat, logo,
                    durasi_pekerjaan, kategori_lokasi,
                    no_polis, berlaku_polis, file_asuransi,
                    luas_bangunan, luas_terbangun, luas_area_terbuka,
                    luas_area_parkir, luas_area_sales, luas_gudang,
                    grand_total, grand_total_non_sbo, grand_total_final,
                    created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,timezone('Asia/Jakarta', now()))
                RETURNING *`,
                [
                    tokoId,
                    payload.status,
                    payload.nama_pt,
                    payload.email_pembuat,
                    payload.logo ?? null,
                    payload.durasi_pekerjaan,
                    payload.kategori_lokasi ?? null,
                    payload.no_polis ?? null,
                    payload.berlaku_polis ?? null,
                    payload.file_asuransi ?? null,
                    payload.luas_bangunan ?? null,
                    payload.luas_terbangun ?? null,
                    payload.luas_area_terbuka ?? null,
                    payload.luas_area_parkir ?? null,
                    payload.luas_area_sales ?? null,
                    payload.luas_gudang ?? null,
                    payload.grand_total,
                    payload.grand_total_non_sbo,
                    payload.grand_total_final
                ]
            );

            const rab = res.rows[0];

            // 3. Insert rab_item
            await insertRabItems(client, rab.id, payload.detail_items);

            return { ...rab, toko_id: tokoId };
        });
    },

    /** Ambil RAB lengkap: header + toko + items */
    async findById(id: string): Promise<{
        rab: RabRow;
        toko: TokoJoinRow;
        items: RabItemRow[];
    } | null> {
        const header = await pool.query<RabRow & TokoJoinRow>(
            `SELECT ${RAB_COLUMNS},
                t.id AS toko_id, t.nomor_ulok, t.lingkup_pekerjaan,
                t.nama_toko, t.kode_toko, t.proyek, t.cabang, t.alamat, t.nama_kontraktor,
                uc_dir.nama_lengkap AS nama_lengkap_persetujuan_direktur
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            LEFT JOIN user_cabang uc_dir
                ON LOWER(uc_dir.email_sat) = LOWER(r.pemberi_persetujuan_direktur)
                AND LOWER(uc_dir.cabang) = LOWER(t.cabang)
            WHERE r.id = $1`,
            [id]
        );

        if (header.rowCount === 0) return null;

        const row = header.rows[0];

        const items = await pool.query<RabItemRow>(
            `SELECT id, id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan,
                volume, harga_material, harga_upah,
                total_material, total_upah, total_harga, catatan
            FROM rab_item
            WHERE id_rab = $1
            ORDER BY id ASC`,
            [id]
        );

        const rab: RabRow = {
            id: row.id,
            id_toko: row.id_toko,
            no_sph: row.no_sph,
            status: row.status,
            nama_pt: row.nama_pt,
            email_pembuat: row.email_pembuat,
            logo: row.logo,
            link_pdf_gabungan: row.link_pdf_gabungan,
            link_pdf_non_sbo: row.link_pdf_non_sbo,
            link_pdf_rekapitulasi: row.link_pdf_rekapitulasi,
            pemberi_persetujuan_koordinator: row.pemberi_persetujuan_koordinator,
            waktu_persetujuan_koordinator: row.waktu_persetujuan_koordinator,
            pemberi_persetujuan_manager: row.pemberi_persetujuan_manager,
            waktu_persetujuan_manager: row.waktu_persetujuan_manager,
            pemberi_persetujuan_direktur: row.pemberi_persetujuan_direktur,
            nama_lengkap_persetujuan_direktur: (row as any).nama_lengkap_persetujuan_direktur ?? null,
            waktu_persetujuan_direktur: row.waktu_persetujuan_direktur,
            alasan_penolakan: row.alasan_penolakan,
            waktu_penolakan: row.waktu_penolakan,
            ditolak_oleh: row.ditolak_oleh,
            durasi_pekerjaan: row.durasi_pekerjaan,
            kategori_lokasi: row.kategori_lokasi,
            no_polis: row.no_polis,
            berlaku_polis: row.berlaku_polis,
            file_asuransi: row.file_asuransi,
            luas_bangunan: row.luas_bangunan,
            luas_terbangun: row.luas_terbangun,
            luas_area_terbuka: row.luas_area_terbuka,
            luas_area_parkir: row.luas_area_parkir,
            luas_area_sales: row.luas_area_sales,
            luas_gudang: row.luas_gudang,
            grand_total: row.grand_total,
            grand_total_non_sbo: row.grand_total_non_sbo,
            grand_total_final: row.grand_total_final,
            created_at: row.created_at
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

        return { rab, toko, items: items.rows };
    },

    /** List RAB dengan filter. Join toko untuk nomor_ulok filter. */
    async list(filter: { status?: string; nomor_ulok?: string; cabang?: string }): Promise<(RabRow & {
        nomor_ulok: string;
        lingkup_pekerjaan: string | null;
        nama_toko: string | null;
        cabang: string | null;
        proyek: string | null;
    })[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];

        if (filter.status) {
            values.push(filter.status);
            conditions.push(`r.status = $${values.length}`);
        }

        if (filter.nomor_ulok) {
            values.push(filter.nomor_ulok);
            conditions.push(`t.nomor_ulok = $${values.length}`);
        }

        if (filter.cabang) {
            values.push(filter.cabang);
            conditions.push(`t.cabang = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query(
            `SELECT ${RAB_COLUMNS},
                t.nomor_ulok, t.lingkup_pekerjaan, t.nama_toko, t.cabang, t.proyek
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            ${whereClause}
            ORDER BY r.created_at DESC`,
            values
        );

        return result.rows;
    },

    /** Update status + kolom approval saat tindakan APPROVE di tabel rab */
    async updateApproval(
        rabId: string,
        newStatus: RabStatus,
        action: ApprovalActionInput
    ): Promise<void> {
        if (action.tindakan !== "APPROVE") {
            throw new Error("updateApproval hanya untuk tindakan APPROVE");
        }

        const sets: string[] = ["status = $1"];
        const values: unknown[] = [newStatus];

        if (action.jabatan === "KOORDINATOR") {
            values.push(action.approver_email);
            sets.push(`pemberi_persetujuan_koordinator = $${values.length}`);
            sets.push(`waktu_persetujuan_koordinator = timezone('Asia/Jakarta', now())`);
        } else if (action.jabatan === "MANAGER") {
            values.push(action.approver_email);
            sets.push(`pemberi_persetujuan_manager = $${values.length}`);
            sets.push(`waktu_persetujuan_manager = timezone('Asia/Jakarta', now())`);
        } else {
            values.push(action.approver_email);
            sets.push(`pemberi_persetujuan_direktur = $${values.length}`);
            sets.push(`waktu_persetujuan_direktur = timezone('Asia/Jakarta', now())`);
        }

        values.push(rabId);
        await pool.query(
            `UPDATE rab SET ${sets.join(", ")} WHERE id = $${values.length}`,
            values
        );
    },

    /**
     * Saat REJECT, hanya update kolom penolakan di tabel rab.
     * Tidak menyentuh kolom tabel lain.
     */
    async rejectRab(
        rabId: string,
        newStatus: RabStatus,
        alasanPenolakan: string,
        ditolakOleh: string
    ): Promise<void> {
        await pool.query(
            `UPDATE rab
             SET status = $1,
                 alasan_penolakan = $2,
                 waktu_penolakan = timezone('Asia/Jakarta', now()),
                 ditolak_oleh = $3
             WHERE id = $4`,
            [newStatus, alasanPenolakan, ditolakOleh, rabId]
        );
    },

    /**
     * Saat REJECT:
     * - Update kolom penolakan di tabel rab
     * - Aktifkan gantt_chart terbaru milik toko terkait
     * - Lindungi kolom toko agar tidak berubah oleh side-effect trigger
     */
    async rejectRabAndActivateLatestGanttGuarded(
        rabId: string,
        newStatus: RabStatus,
        alasanPenolakan: string,
        ditolakOleh: string
    ): Promise<void> {
        await withTransaction(async (client) => {
            const rabRes = await client.query<{ id_toko: number }>(
                `SELECT id_toko
                 FROM rab
                 WHERE id = $1
                 FOR UPDATE`,
                [rabId]
            );

            if ((rabRes.rowCount ?? 0) === 0) {
                throw new Error(`RAB dengan id ${rabId} tidak ditemukan`);
            }

            const tokoId = rabRes.rows[0].id_toko;

            const tokoBeforeRes = await client.query<{
                kode_toko: string | null;
                alamat: string | null;
                nama_kontraktor: string | null;
            }>(
                `SELECT kode_toko, alamat, nama_kontraktor
                 FROM toko
                 WHERE id = $1
                 FOR UPDATE`,
                [tokoId]
            );

            if ((tokoBeforeRes.rowCount ?? 0) === 0) {
                throw new Error(`Toko dengan id ${tokoId} tidak ditemukan`);
            }

            const tokoBefore = tokoBeforeRes.rows[0];

            await client.query(
                `UPDATE rab
                 SET status = $1,
                     alasan_penolakan = $2,
                     waktu_penolakan = timezone('Asia/Jakarta', now()),
                     ditolak_oleh = $3
                 WHERE id = $4`,
                [newStatus, alasanPenolakan, ditolakOleh, rabId]
            );

            await client.query(
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

            // Hard-guard: pulihkan kolom toko yang wajib stabil setelah reject.
            await client.query(
                `UPDATE toko
                 SET kode_toko = $1,
                     alamat = $2,
                     nama_kontraktor = $3
                 WHERE id = $4`,
                [
                    tokoBefore.kode_toko,
                    tokoBefore.alamat,
                    tokoBefore.nama_kontraktor,
                    tokoId
                ]
            );

            const tokoAfterRes = await client.query<{
                kode_toko: string | null;
                alamat: string | null;
                nama_kontraktor: string | null;
            }>(
                `SELECT kode_toko, alamat, nama_kontraktor
                 FROM toko
                 WHERE id = $1`,
                [tokoId]
            );

            const tokoAfter = tokoAfterRes.rows[0];
            if (JSON.stringify(tokoBefore) !== JSON.stringify(tokoAfter)) {
                throw new Error("Guard violation: reject RAB tidak boleh mengubah data toko");
            }
        });
    },

    /** Simpan link PDF SPH setelah upload ke Drive */
    async updateSphPdfLink(rabId: string, linkPdfSph: string): Promise<void> {
        await pool.query(
            `UPDATE rab SET link_pdf_sph = $1 WHERE id = $2`,
            [linkPdfSph, rabId]
        );
    },

    /**
     * Ambil / assign no_sph dengan aturan:
     * - jika rab sudah punya no_sph, pakai itu
     * - jika belum, generate nomor acak 4 digit (1000-9999)
     */
    async ensureSphNumber(rabId: string): Promise<number> {
        return withTransaction(async (client) => {
            await client.query(`SELECT pg_advisory_xact_lock(hashtext('rab_no_sph_sequence'))`);

            const currentRes = await client.query<{ no_sph: number | null }>(
                `SELECT no_sph FROM rab WHERE id = $1 FOR UPDATE`,
                [rabId]
            );

            if ((currentRes.rowCount ?? 0) === 0) {
                throw new Error(`RAB dengan id ${rabId} tidak ditemukan`);
            }

            const currentNoSph = currentRes.rows[0].no_sph;
            if (currentNoSph !== null) {
                return currentNoSph;
            }

            const min = 1000;
            const max = 9999;
            const maxAttempts = 50;

            let nextNoSph: number | null = null;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const candidate = Math.floor(Math.random() * (max - min + 1)) + min;
                const existsRes = await client.query<{ exists: boolean }>(
                    `SELECT EXISTS(SELECT 1 FROM rab WHERE no_sph = $1) AS exists`,
                    [candidate]
                );

                if (!existsRes.rows[0]?.exists) {
                    nextNoSph = candidate;
                    break;
                }
            }

            if (nextNoSph === null) {
                throw new Error("Gagal generate no_sph acak 4 digit yang unik");
            }

            const updatedRes = await client.query<{ no_sph: number }>(
                `UPDATE rab
                 SET no_sph = $1
                 WHERE id = $2
                 RETURNING no_sph`,
                [nextNoSph, rabId]
            );

            return updatedRes.rows[0].no_sph;
        });
    },

    /** Simpan link PDF setelah upload ke Drive */
    async updatePdfLinks(
        rabId: string,
        links: {
            link_pdf_gabungan: string;
            link_pdf_non_sbo: string;
            link_pdf_rekapitulasi: string;
        }
    ): Promise<void> {
        await pool.query(
            `UPDATE rab
             SET link_pdf_gabungan = $1,
                 link_pdf_non_sbo = $2,
                 link_pdf_rekapitulasi = $3
             WHERE id = $4`,
            [links.link_pdf_gabungan, links.link_pdf_non_sbo, links.link_pdf_rekapitulasi, rabId]
        );
    },

    /**
     * Pulihkan kolom toko yang wajib stabil setelah proses approval RAB.
     * Ini menjadi guard jika ada side-effect trigger saat update tabel rab.
     */
    async restoreTokoStableFieldsByRabId(rabId: string, fields: TokoStableFields): Promise<void> {
        await pool.query(
            `UPDATE toko t
             SET kode_toko = $1,
                 alamat = $2,
                 nama_kontraktor = $3
             FROM rab r
             WHERE r.id = $4
               AND t.id = r.id_toko`,
            [fields.kode_toko, fields.alamat, fields.nama_kontraktor, rabId]
        );
    }
};
