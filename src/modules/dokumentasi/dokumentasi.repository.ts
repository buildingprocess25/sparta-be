import { pool, withTransaction } from "../../db/pool";
import type {
    DokumentasiBangunanCreateInput,
    DokumentasiBangunanListQueryInput,
    DokumentasiBangunanUpdateInput
} from "./dokumentasi.schema";

export type DokumentasiBangunanRow = {
    id: number;
    nomor_ulok: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    cabang: string | null;
    tanggal_go: string | null;
    tanggal_serah_terima: string | null;
    tanggal_ambil_foto: string | null;
    spk_awal: string | null;
    spk_akhir: string | null;
    kontraktor_sipil: string | null;
    kontraktor_me: string | null;
    link_pdf: string | null;
    email_pengirim: string | null;
    status_validasi: string | null;
    alasan_revisi: string | null;
    pic_dokumentasi: string | null;
    created_at: string;
};

export type DokumentasiBangunanItemRow = {
    id: number;
    id_dokumentasi_bangunan: number;
    link_foto: string | null;
    created_at: string;
};

export type DokumentasiBangunanDetail = {
    dokumentasi: DokumentasiBangunanRow;
    items: DokumentasiBangunanItemRow[];
};

export const dokumentasiBangunanRepository = {
    async create(input: DokumentasiBangunanCreateInput): Promise<DokumentasiBangunanRow> {
        const result = await pool.query<DokumentasiBangunanRow>(
            `
            INSERT INTO dokumentasi_bangunan (
                nomor_ulok,
                nama_toko,
                kode_toko,
                cabang,
                tanggal_go,
                tanggal_serah_terima,
                tanggal_ambil_foto,
                spk_awal,
                spk_akhir,
                kontraktor_sipil,
                kontraktor_me,
                email_pengirim,
                status_validasi,
                alasan_revisi,
                pic_dokumentasi
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING
                id,
                nomor_ulok,
                nama_toko,
                kode_toko,
                cabang,
                tanggal_go,
                tanggal_serah_terima,
                tanggal_ambil_foto,
                spk_awal,
                spk_akhir,
                kontraktor_sipil,
                kontraktor_me,
                link_pdf,
                email_pengirim,
                status_validasi,
                alasan_revisi,
                pic_dokumentasi,
                created_at
            `,
            [
                input.nomor_ulok,
                input.nama_toko,
                input.kode_toko,
                input.cabang ?? null,
                input.tanggal_go ?? null,
                input.tanggal_serah_terima ?? null,
                input.tanggal_ambil_foto ?? null,
                input.spk_awal ?? null,
                input.spk_akhir ?? null,
                input.kontraktor_sipil ?? null,
                input.kontraktor_me ?? null,
                input.email_pengirim ?? null,
                input.status_validasi ?? null,
                input.alasan_revisi ?? null,
                input.pic_dokumentasi ?? null
            ]
        );

        return result.rows[0];
    },

    async update(id: number, input: DokumentasiBangunanUpdateInput): Promise<DokumentasiBangunanRow | null> {
        const fields: string[] = [];
        const values: Array<string | null> = [];

        const pushField = (column: string, value: string | undefined) => {
            if (typeof value === "undefined") return;
            values.push(value ?? null);
            fields.push(`${column} = $${values.length}`);
        };

        pushField("nomor_ulok", input.nomor_ulok);
        pushField("nama_toko", input.nama_toko);
        pushField("kode_toko", input.kode_toko);
        pushField("cabang", input.cabang);
        pushField("tanggal_go", input.tanggal_go);
        pushField("tanggal_serah_terima", input.tanggal_serah_terima);
        pushField("tanggal_ambil_foto", input.tanggal_ambil_foto);
        pushField("spk_awal", input.spk_awal);
        pushField("spk_akhir", input.spk_akhir);
        pushField("kontraktor_sipil", input.kontraktor_sipil);
        pushField("kontraktor_me", input.kontraktor_me);
        pushField("email_pengirim", input.email_pengirim);
        pushField("status_validasi", input.status_validasi);
        pushField("alasan_revisi", input.alasan_revisi);
        pushField("pic_dokumentasi", input.pic_dokumentasi);

        if (fields.length === 0) {
            return this.findById(id);
        }

        const result = await pool.query<DokumentasiBangunanRow>(
            `
            UPDATE dokumentasi_bangunan
            SET ${fields.join(", ")}
            WHERE id = $${values.length + 1}
            RETURNING
                id,
                nomor_ulok,
                nama_toko,
                kode_toko,
                cabang,
                tanggal_go,
                tanggal_serah_terima,
                tanggal_ambil_foto,
                spk_awal,
                spk_akhir,
                kontraktor_sipil,
                kontraktor_me,
                link_pdf,
                email_pengirim,
                status_validasi,
                alasan_revisi,
                pic_dokumentasi,
                created_at
            `,
            [...values, id]
        );

        return result.rows[0] ?? null;
    },

    async updatePdfLink(id: number, linkPdf: string): Promise<void> {
        await pool.query(
            `UPDATE dokumentasi_bangunan SET link_pdf = $1 WHERE id = $2`,
            [linkPdf, id]
        );
    },

    async findById(id: number): Promise<DokumentasiBangunanRow | null> {
        const result = await pool.query<DokumentasiBangunanRow>(
            `
            SELECT
                id,
                nomor_ulok,
                nama_toko,
                kode_toko,
                cabang,
                tanggal_go,
                tanggal_serah_terima,
                tanggal_ambil_foto,
                spk_awal,
                spk_akhir,
                kontraktor_sipil,
                kontraktor_me,
                link_pdf,
                email_pengirim,
                status_validasi,
                alasan_revisi,
                pic_dokumentasi,
                created_at
            FROM dokumentasi_bangunan
            WHERE id = $1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async list(query: DokumentasiBangunanListQueryInput): Promise<DokumentasiBangunanRow[]> {
        const conditions: string[] = [];
        const values: Array<string> = [];

        if (query.cabang) {
            values.push(query.cabang);
            conditions.push(`LOWER(cabang) = LOWER($${values.length})`);
        }

        if (query.kode_toko) {
            values.push(query.kode_toko);
            conditions.push(`LOWER(kode_toko) = LOWER($${values.length})`);
        }

        if (query.nomor_ulok) {
            values.push(query.nomor_ulok);
            conditions.push(`LOWER(nomor_ulok) = LOWER($${values.length})`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<DokumentasiBangunanRow>(
            `
            SELECT
                id,
                nomor_ulok,
                nama_toko,
                kode_toko,
                cabang,
                tanggal_go,
                tanggal_serah_terima,
                tanggal_ambil_foto,
                spk_awal,
                spk_akhir,
                kontraktor_sipil,
                kontraktor_me,
                link_pdf,
                email_pengirim,
                status_validasi,
                alasan_revisi,
                pic_dokumentasi,
                created_at
            FROM dokumentasi_bangunan
            ${whereClause}
            ORDER BY created_at DESC, id DESC
            `,
            values
        );

        return result.rows;
    },

    async delete(id: number): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM dokumentasi_bangunan WHERE id = $1`,
            [id]
        );

        return (result.rowCount ?? 0) > 0;
    },

    async getItems(idDokumentasi: number): Promise<DokumentasiBangunanItemRow[]> {
        const result = await pool.query<DokumentasiBangunanItemRow>(
            `
            SELECT id, id_dokumentasi_bangunan, link_foto, created_at
            FROM dokumentasi_bangunan_item
            WHERE id_dokumentasi_bangunan = $1
            ORDER BY id ASC
            `,
            [idDokumentasi]
        );

        return result.rows;
    },

    async createItemsBulk(idDokumentasi: number, links: string[]): Promise<DokumentasiBangunanItemRow[]> {
        if (links.length === 0) return [];

        return withTransaction(async (client) => {
            const values: Array<number | string | null> = [];
            const placeholders = links.map((link, index) => {
                const base = index * 2;
                values.push(idDokumentasi, link);
                return `($${base + 1}, $${base + 2})`;
            });

            const result = await client.query<DokumentasiBangunanItemRow>(
                `
                INSERT INTO dokumentasi_bangunan_item (id_dokumentasi_bangunan, link_foto)
                VALUES ${placeholders.join(", ")}
                RETURNING id, id_dokumentasi_bangunan, link_foto, created_at
                `,
                values
            );

            return result.rows;
        });
    },

    async deleteItem(itemId: number): Promise<DokumentasiBangunanItemRow | null> {
        const result = await pool.query<DokumentasiBangunanItemRow>(
            `
            DELETE FROM dokumentasi_bangunan_item
            WHERE id = $1
            RETURNING id, id_dokumentasi_bangunan, link_foto, created_at
            `,
            [itemId]
        );

        return result.rows[0] ?? null;
    },

    async getDetail(id: number): Promise<DokumentasiBangunanDetail | null> {
        const dokumentasi = await this.findById(id);
        if (!dokumentasi) return null;
        const items = await this.getItems(id);
        return { dokumentasi, items };
    }
};
