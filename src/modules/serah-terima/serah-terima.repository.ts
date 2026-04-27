import { pool } from "../../db/pool";

export type BerkasSerahTerimaRow = {
    id: number;
    id_toko: number;
    link_pdf: string | null;
    created_at: string;
};

export type OpnameFinalRow = {
    id: number;
    id_toko: number;
    aksi: string;
    status_opname_final: string;
    link_pdf_opname: string | null;
    email_pembuat: string | null;
    pemberi_persetujuan_direktur: string | null;
    waktu_persetujuan_direktur: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    alasan_penolakan: string | null;
    grand_total_opname: string | null;
    grand_total_rab: string | null;
    created_at: string;
};

export type OpnameItemDetailRow = {
    id: number;
    id_toko: number;
    id_opname_final: number;
    id_rab_item: number;
    status: string;
    volume_akhir: number;
    selisih_volume: number;
    total_selisih: number;
    total_harga_opname: number;
    desain: string | null;
    kualitas: string | null;
    spesifikasi: string | null;
    foto: string | null;
    catatan: string | null;
    created_at: string;
    // joined from rab_item
    kategori_pekerjaan: string | null;
    jenis_pekerjaan: string | null;
    satuan: string | null;
    volume_rab: number | null;
    total_harga_rab: number | null;
};

export type TokoRow = {
    id: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    proyek: string | null;
    cabang: string | null;
    alamat: string | null;
    nama_kontraktor: string | null;
};

export type SerahTerimaDetail = {
    toko: TokoRow;
    opname_final: OpnameFinalRow;
    items: OpnameItemDetailRow[];
};

export const serahTerimaRepository = {
    async findTokoById(idToko: number): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `
            SELECT
                id,
                nomor_ulok,
                lingkup_pekerjaan,
                nama_toko,
                kode_toko,
                proyek,
                cabang,
                alamat,
                nama_kontraktor
            FROM toko
            WHERE id = $1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async findOpnameFinalByIdToko(idToko: number): Promise<OpnameFinalRow | null> {
        const result = await pool.query<OpnameFinalRow>(
            `
            SELECT
                id,
                id_toko,
                aksi,
                status_opname_final,
                link_pdf_opname,
                email_pembuat,
                pemberi_persetujuan_direktur,
                waktu_persetujuan_direktur,
                pemberi_persetujuan_koordinator,
                waktu_persetujuan_koordinator,
                pemberi_persetujuan_manager,
                waktu_persetujuan_manager,
                alasan_penolakan,
                grand_total_opname,
                grand_total_rab,
                created_at
            FROM opname_final
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async findOpnameItemsByOpnameFinalId(opnameFinalId: number): Promise<OpnameItemDetailRow[]> {
        const result = await pool.query<OpnameItemDetailRow>(
            `
            SELECT
                oi.id,
                oi.id_toko,
                oi.id_opname_final,
                oi.id_rab_item,
                oi.status,
                oi.volume_akhir,
                oi.selisih_volume,
                oi.total_selisih,
                oi.total_harga_opname,
                oi.desain,
                oi.kualitas,
                oi.spesifikasi,
                oi.foto,
                oi.catatan,
                oi.created_at,
                ri.kategori_pekerjaan,
                ri.jenis_pekerjaan,
                ri.satuan,
                ri.volume     AS volume_rab,
                ri.total_harga AS total_harga_rab
            FROM opname_item oi
            LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
            WHERE oi.id_opname_final = $1
            ORDER BY oi.id ASC
            `,
            [opnameFinalId]
        );

        return result.rows;
    },

    async findBerkasSerahTerimaByIdToko(idToko: number): Promise<BerkasSerahTerimaRow | null> {
        const result = await pool.query<BerkasSerahTerimaRow>(
            `
            SELECT id, id_toko, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async upsertBerkasSerahTerima(idToko: number, linkPdf: string): Promise<BerkasSerahTerimaRow> {
        const existing = await pool.query<BerkasSerahTerimaRow>(
            `
            SELECT id FROM berkas_serah_terima
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
            `,
            [idToko]
        );

        if ((existing.rowCount ?? 0) > 0) {
            const updated = await pool.query<BerkasSerahTerimaRow>(
                `
                UPDATE berkas_serah_terima
                SET link_pdf = $1
                WHERE id = $2
                RETURNING id, id_toko, link_pdf, created_at
                `,
                [linkPdf, existing.rows[0].id]
            );

            return updated.rows[0];
        }

        const inserted = await pool.query<BerkasSerahTerimaRow>(
            `
            INSERT INTO berkas_serah_terima (id_toko, link_pdf)
            VALUES ($1, $2)
            RETURNING id, id_toko, link_pdf, created_at
            `,
            [idToko, linkPdf]
        );

        return inserted.rows[0];
    },
};
