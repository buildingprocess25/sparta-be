import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/pool";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { ACTIVE_RAB_STATUSES, type RabStatus } from "./rab.constants";
import type { DetailItemInput } from "./rab.schema";

// ---------------------------------------------------------------------------
// Row types – sesuai tabel rab, rab_item, toko
// ---------------------------------------------------------------------------

export type RabRow = {
    id: number;
    id_toko: number;
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
    waktu_persetujuan_direktur: string | null;
    alasan_penolakan: string | null;
    durasi_pekerjaan: string | null;
    kategori_lokasi: string | null;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RAB_COLUMNS = `
    r.id, r.id_toko, r.status, r.nama_pt, r.email_pembuat, r.logo,
    r.link_pdf_gabungan, r.link_pdf_non_sbo, r.link_pdf_rekapitulasi,
    r.pemberi_persetujuan_koordinator, r.waktu_persetujuan_koordinator,
    r.pemberi_persetujuan_manager, r.waktu_persetujuan_manager,
    r.pemberi_persetujuan_direktur, r.waktu_persetujuan_direktur,
    r.alasan_penolakan, r.durasi_pekerjaan, r.kategori_lokasi,
    r.luas_bangunan, r.luas_terbangun, r.luas_area_terbuka,
    r.luas_area_parkir, r.luas_area_sales, r.luas_gudang,
    r.grand_total, r.grand_total_non_sbo, r.grand_total_final, r.created_at
`;

const insertRabItems = async (
    client: PoolClient,
    rabId: number,
    detailItems: DetailItemInput[]
): Promise<void> => {
    for (const item of detailItems) {
        const totalMaterial = item.volume * item.harga_material;
        const totalUpah = item.volume * item.harga_upah;
        const totalHarga = totalMaterial + totalUpah;

        await client.query(
            `INSERT INTO rab_item (
                id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan,
                volume, harga_material, harga_upah,
                total_material, total_upah, total_harga
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                rabId,
                item.kategori_pekerjaan,
                item.jenis_pekerjaan,
                item.satuan,
                item.volume,
                item.harga_material,
                item.harga_upah,
                totalMaterial,
                totalUpah,
                totalHarga
            ]
        );
    }
};

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const rabRepository = {
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

    /** Upsert toko + buat RAB header + items dalam satu transaksi */
    async createWithDetails(payload: {
        // toko fields
        nomor_ulok: string;
        lingkup_pekerjaan?: string;
        nama_toko?: string;
        kode_toko?: string;
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
                    nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko,
                    proyek, cabang, alamat, nama_kontraktor
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (nomor_ulok) DO UPDATE SET
                    lingkup_pekerjaan = COALESCE(EXCLUDED.lingkup_pekerjaan, toko.lingkup_pekerjaan),
                    nama_toko = COALESCE(EXCLUDED.nama_toko, toko.nama_toko),
                    kode_toko = COALESCE(EXCLUDED.kode_toko, toko.kode_toko),
                    proyek = COALESCE(EXCLUDED.proyek, toko.proyek),
                    cabang = COALESCE(EXCLUDED.cabang, toko.cabang),
                    alamat = COALESCE(EXCLUDED.alamat, toko.alamat),
                    nama_kontraktor = COALESCE(EXCLUDED.nama_kontraktor, toko.nama_kontraktor)
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
            const tokoId = tokoRes.rows[0].id;

            // 2. Insert RAB header
            const res = await client.query<RabRow>(
                `INSERT INTO rab (
                    id_toko, status, nama_pt, email_pembuat, logo,
                    durasi_pekerjaan, kategori_lokasi,
                    luas_bangunan, luas_terbangun, luas_area_terbuka,
                    luas_area_parkir, luas_area_sales, luas_gudang,
                    grand_total, grand_total_non_sbo, grand_total_final,
                    created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_DATE)
                RETURNING *`,
                [
                    tokoId,
                    payload.status,
                    payload.nama_pt,
                    payload.email_pembuat,
                    payload.logo ?? null,
                    payload.durasi_pekerjaan,
                    payload.kategori_lokasi ?? null,
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
                t.nama_toko, t.kode_toko, t.proyek, t.cabang, t.alamat, t.nama_kontraktor
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            WHERE r.id = $1`,
            [id]
        );

        if (header.rowCount === 0) return null;

        const row = header.rows[0];

        const items = await pool.query<RabItemRow>(
            `SELECT id, id_rab, kategori_pekerjaan, jenis_pekerjaan, satuan,
                volume, harga_material, harga_upah,
                total_material, total_upah, total_harga
            FROM rab_item
            WHERE id_rab = $1
            ORDER BY id ASC`,
            [id]
        );

        const rab: RabRow = {
            id: row.id,
            id_toko: row.id_toko,
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
            waktu_persetujuan_direktur: row.waktu_persetujuan_direktur,
            alasan_penolakan: row.alasan_penolakan,
            durasi_pekerjaan: row.durasi_pekerjaan,
            kategori_lokasi: row.kategori_lokasi,
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
    async list(filter: { status?: string; nomor_ulok?: string; cabang?: string }): Promise<(RabRow & { nomor_ulok: string; nama_toko: string | null; cabang: string | null; proyek: string | null })[]> {
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
                t.nomor_ulok, t.nama_toko, t.cabang, t.proyek
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            ${whereClause}
            ORDER BY r.created_at DESC`,
            values
        );

        return result.rows;
    },

    /** Update status + kolom approval yang relevan di tabel rab */
    async updateApproval(
        rabId: string,
        newStatus: RabStatus,
        action: ApprovalActionInput
    ): Promise<void> {
        const now = new Date().toISOString();
        const sets: string[] = ["status = $1"];
        const values: unknown[] = [newStatus];

        if (action.tindakan === "APPROVE") {
            if (action.jabatan === "KOORDINATOR") {
                values.push(action.approver_email, now);
                sets.push(`pemberi_persetujuan_koordinator = $${values.length - 1}`);
                sets.push(`waktu_persetujuan_koordinator = $${values.length}`);
            } else if (action.jabatan === "MANAGER") {
                values.push(action.approver_email, now);
                sets.push(`pemberi_persetujuan_manager = $${values.length - 1}`);
                sets.push(`waktu_persetujuan_manager = $${values.length}`);
            } else {
                values.push(action.approver_email, now);
                sets.push(`pemberi_persetujuan_direktur = $${values.length - 1}`);
                sets.push(`waktu_persetujuan_direktur = $${values.length}`);
            }
        } else {
            values.push(action.alasan_penolakan ?? null);
            sets.push(`alasan_penolakan = $${values.length}`);
        }

        values.push(rabId);
        await pool.query(
            `UPDATE rab SET ${sets.join(", ")} WHERE id = $${values.length}`,
            values
        );
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
    }
};
