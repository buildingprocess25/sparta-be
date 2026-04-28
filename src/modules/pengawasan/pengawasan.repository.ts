import { pool, withTransaction } from "../../db/pool";
import type {
    CreatePengawasanData,
    ListPengawasanQueryInput,
    UpdatePengawasanInput
} from "./pengawasan.schema";

export type PengawasanRow = {
    id: number;
    id_gantt: number;
    id_pengawasan_gantt: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    catatan: string | null;
    dokumentasi: string | null;
    status: string;
    created_at: string;
};

export type BerkasPengawasanRow = {
    id: number;
    id_pengawasan_gantt: number;
    link_pdf_pengawasan: string | null;
    created_at: string;
};

export type PicPengawasanDisplayRow = {
    plc_building_support: string | null;
};

export type PengawasanRowWithBerkas = PengawasanRow & {
    berkas_pengawasan: BerkasPengawasanRow | null;
};

export const pengawasanRepository = {
    async create(input: CreatePengawasanData): Promise<PengawasanRow> {
        const result = await pool.query<PengawasanRow>(
            `
            INSERT INTO pengawasan (id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan, dokumentasi, status)
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'progress'))
            RETURNING id, id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan, dokumentasi, status, created_at
            `,
            [
                input.id_gantt,
                input.id_pengawasan_gantt,
                input.kategori_pekerjaan,
                input.jenis_pekerjaan,
                input.catatan ?? null,
                input.dokumentasi ?? null,
                input.status ?? null
            ]
        );

        return result.rows[0];
    },

    async createBulk(items: CreatePengawasanData[]): Promise<PengawasanRow[]> {
        return withTransaction(async (client) => {
            const values: Array<number | string | null> = [];
            const placeholders = items.map((item, index) => {
                const base = index * 7;
                values.push(
                    item.id_gantt,
                    item.id_pengawasan_gantt,
                    item.kategori_pekerjaan,
                    item.jenis_pekerjaan,
                    item.catatan ?? null,
                    item.dokumentasi ?? null,
                    item.status ?? null
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, COALESCE($${base + 7}, 'progress'))`;
            });

            const result = await client.query<PengawasanRow>(
                `
                INSERT INTO pengawasan (id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan, dokumentasi, status)
                VALUES ${placeholders.join(", ")}
                RETURNING id, id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan, dokumentasi, status, created_at
                `,
                values
            );

            return result.rows;
        });
    },

    async findById(id: string): Promise<PengawasanRowWithBerkas | null> {
        type RawRow = PengawasanRow & {
            bp_id: number | null;
            bp_id_pengawasan_gantt: number | null;
            bp_link_pdf_pengawasan: string | null;
            bp_created_at: string | null;
        };

        const result = await pool.query<RawRow>(
            `
            SELECT
                p.id, p.id_gantt, p.id_pengawasan_gantt,
                p.kategori_pekerjaan, p.jenis_pekerjaan,
                p.catatan, p.dokumentasi, p.status, p.created_at,
                bp.id AS bp_id,
                bp.id_pengawasan_gantt AS bp_id_pengawasan_gantt,
                bp.link_pdf_pengawasan AS bp_link_pdf_pengawasan,
                bp.created_at AS bp_created_at
            FROM pengawasan p
            LEFT JOIN berkas_pengawasan bp ON bp.id_pengawasan_gantt = p.id_pengawasan_gantt
            WHERE p.id = $1
            `,
            [id]
        );

        const row = result.rows[0];
        if (!row) return null;

        const { bp_id, bp_id_pengawasan_gantt, bp_link_pdf_pengawasan, bp_created_at, ...pengawasan } = row;
        return {
            ...pengawasan,
            berkas_pengawasan: bp_id !== null
                ? {
                    id: bp_id,
                    id_pengawasan_gantt: bp_id_pengawasan_gantt!,
                    link_pdf_pengawasan: bp_link_pdf_pengawasan,
                    created_at: bp_created_at!
                }
                : null
        };
    },

    async findAll(
        query: ListPengawasanQueryInput,
        idPengawasanGantt?: number
    ): Promise<PengawasanRowWithBerkas[]> {
        const conditions: string[] = [];
        const values: Array<number | string> = [];

        if (typeof query.id_gantt !== "undefined") {
            values.push(query.id_gantt);
            conditions.push(`p.id_gantt = $${values.length}`);
        }

        if (query.kategori_pekerjaan) {
            values.push(query.kategori_pekerjaan);
            conditions.push(`p.kategori_pekerjaan = $${values.length}`);
        }

        if (query.jenis_pekerjaan) {
            values.push(query.jenis_pekerjaan);
            conditions.push(`p.jenis_pekerjaan = $${values.length}`);
        }

        if (query.status) {
            values.push(query.status);
            conditions.push(`p.status = $${values.length}`);
        }

        if (typeof idPengawasanGantt !== "undefined") {
            values.push(idPengawasanGantt);
            conditions.push(`p.id_pengawasan_gantt = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        type RawRow = PengawasanRow & {
            bp_id: number | null;
            bp_id_pengawasan_gantt: number | null;
            bp_link_pdf_pengawasan: string | null;
            bp_created_at: string | null;
        };

        const result = await pool.query<RawRow>(
            `
            SELECT
                p.id, p.id_gantt, p.id_pengawasan_gantt,
                p.kategori_pekerjaan, p.jenis_pekerjaan,
                p.catatan, p.dokumentasi, p.status, p.created_at,
                bp.id AS bp_id,
                bp.id_pengawasan_gantt AS bp_id_pengawasan_gantt,
                bp.link_pdf_pengawasan AS bp_link_pdf_pengawasan,
                bp.created_at AS bp_created_at
            FROM pengawasan p
            LEFT JOIN berkas_pengawasan bp ON bp.id_pengawasan_gantt = p.id_pengawasan_gantt
            ${whereClause}
            ORDER BY p.id DESC
            `,
            values
        );

        return result.rows.map((row) => {
            const { bp_id, bp_id_pengawasan_gantt, bp_link_pdf_pengawasan, bp_created_at, ...pengawasan } = row;
            return {
                ...pengawasan,
                berkas_pengawasan: bp_id !== null
                    ? {
                        id: bp_id,
                        id_pengawasan_gantt: bp_id_pengawasan_gantt!,
                        link_pdf_pengawasan: bp_link_pdf_pengawasan,
                        created_at: bp_created_at!
                    }
                    : null
            };
        });
    },

    async updateById(id: string, input: UpdatePengawasanInput): Promise<PengawasanRow | null> {
        const setClauses: string[] = [];
        const values: Array<string> = [];

        if (typeof input.kategori_pekerjaan !== "undefined") {
            values.push(input.kategori_pekerjaan);
            setClauses.push(`kategori_pekerjaan = $${values.length}`);
        }

        if (typeof input.jenis_pekerjaan !== "undefined") {
            values.push(input.jenis_pekerjaan);
            setClauses.push(`jenis_pekerjaan = $${values.length}`);
        }

        if (typeof input.catatan !== "undefined") {
            values.push(input.catatan);
            setClauses.push(`catatan = $${values.length}`);
        }

        if (typeof input.dokumentasi !== "undefined") {
            values.push(input.dokumentasi);
            setClauses.push(`dokumentasi = $${values.length}`);
        }

        if (typeof input.status !== "undefined") {
            values.push(input.status);
            setClauses.push(`status = $${values.length}`);
        }

        values.push(id);

        const result = await pool.query<PengawasanRow>(
            `
            UPDATE pengawasan
            SET ${setClauses.join(", ")}
            WHERE id = $${values.length}
            RETURNING id, id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan, dokumentasi, status, created_at
            `,
            values
        );

        return result.rows[0] ?? null;
    },

    async deleteById(id: string): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM pengawasan WHERE id = $1`,
            [id]
        );

        return (result.rowCount ?? 0) > 0;
    },

    async findPengawasanGanttIdByDate(idGantt: number, tanggalPengawasan: string): Promise<number | null> {
        const result = await pool.query<{ id: number }>(
            `
            SELECT id
            FROM pengawasan_gantt
            WHERE id_gantt = $1
              AND tanggal_pengawasan = $2
            ORDER BY id ASC
            LIMIT 1
            `,
            [idGantt, tanggalPengawasan]
        );

        return result.rows[0]?.id ?? null;
    },

    // ── berkas_pengawasan ────────────────────────────────────────────────

    async upsertBerkasPengawasan(
        idPengawasanGantt: number,
        linkPdfPengawasan: string
    ): Promise<BerkasPengawasanRow> {
        const result = await pool.query<BerkasPengawasanRow>(
            `
            INSERT INTO berkas_pengawasan (id_pengawasan_gantt, link_pdf_pengawasan)
            VALUES ($1, $2)
            ON CONFLICT (id_pengawasan_gantt)
            DO UPDATE SET link_pdf_pengawasan = EXCLUDED.link_pdf_pengawasan,
                          created_at = timezone('Asia/Jakarta', now())
            RETURNING id, id_pengawasan_gantt, link_pdf_pengawasan, created_at
            `,
            [idPengawasanGantt, linkPdfPengawasan]
        );

        return result.rows[0];
    },

    async findBerkasByPengawasanGanttId(idPengawasanGantt: number): Promise<BerkasPengawasanRow | null> {
        const result = await pool.query<BerkasPengawasanRow>(
            `
            SELECT id, id_pengawasan_gantt, link_pdf_pengawasan, created_at
            FROM berkas_pengawasan
            WHERE id_pengawasan_gantt = $1
            `,
            [idPengawasanGantt]
        );

        return result.rows[0] ?? null;
    },

    async findAllPengawasanByGanttId(idPengawasanGantt: number): Promise<PengawasanRow[]> {
        const result = await pool.query<PengawasanRow>(
            `
            SELECT id, id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, catatan, dokumentasi, status, created_at
            FROM pengawasan
            WHERE id_pengawasan_gantt = $1
            ORDER BY id ASC
            `,
            [idPengawasanGantt]
        );

        return result.rows;
    },

    async findPicPengawasanByPengawasanGanttId(
        idPengawasanGantt: number
    ): Promise<PicPengawasanDisplayRow | null> {
        const result = await pool.query<PicPengawasanDisplayRow>(
            `
            SELECT pic.plc_building_support
            FROM pengawasan_gantt pg
            LEFT JOIN gantt_chart gc ON gc.id = pg.id_gantt
            LEFT JOIN pic_pengawasan pic ON pic.id_toko = gc.id_toko
            WHERE pg.id = $1
            LIMIT 1
            `,
            [idPengawasanGantt]
        );

        return result.rows[0] ?? null;
    }
};
