import { pool, withTransaction } from "../../db/pool";
import type {
    CreatePengawasanInput,
    ListPengawasanQueryInput,
    UpdatePengawasanInput
} from "./pengawasan.schema";

export type PengawasanRow = {
    id: number;
    id_gantt: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    status: string;
    created_at: string;
};

export const pengawasanRepository = {
    async create(input: CreatePengawasanInput): Promise<PengawasanRow> {
        const result = await pool.query<PengawasanRow>(
            `
            INSERT INTO pengawasan (id_gantt, kategori_pekerjaan, jenis_pekerjaan, status)
            VALUES ($1, $2, $3, COALESCE($4, 'active'))
            RETURNING id, id_gantt, kategori_pekerjaan, jenis_pekerjaan, status, created_at
            `,
            [
                input.id_gantt,
                input.kategori_pekerjaan,
                input.jenis_pekerjaan,
                input.status ?? null
            ]
        );

        return result.rows[0];
    },

    async createBulk(items: CreatePengawasanInput[]): Promise<PengawasanRow[]> {
        return withTransaction(async (client) => {
            const values: Array<number | string | null> = [];
            const placeholders = items.map((item, index) => {
                const base = index * 4;
                values.push(
                    item.id_gantt,
                    item.kategori_pekerjaan,
                    item.jenis_pekerjaan,
                    item.status ?? null
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, COALESCE($${base + 4}, 'active'))`;
            });

            const result = await client.query<PengawasanRow>(
                `
                INSERT INTO pengawasan (id_gantt, kategori_pekerjaan, jenis_pekerjaan, status)
                VALUES ${placeholders.join(", ")}
                RETURNING id, id_gantt, kategori_pekerjaan, jenis_pekerjaan, status, created_at
                `,
                values
            );

            return result.rows;
        });
    },

    async findById(id: string): Promise<PengawasanRow | null> {
        const result = await pool.query<PengawasanRow>(
            `
            SELECT id, id_gantt, kategori_pekerjaan, jenis_pekerjaan, status, created_at
            FROM pengawasan
            WHERE id = $1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async findAll(query: ListPengawasanQueryInput): Promise<PengawasanRow[]> {
        const conditions: string[] = [];
        const values: Array<number | string> = [];

        if (typeof query.id_gantt !== "undefined") {
            values.push(query.id_gantt);
            conditions.push(`id_gantt = $${values.length}`);
        }

        if (query.kategori_pekerjaan) {
            values.push(query.kategori_pekerjaan);
            conditions.push(`kategori_pekerjaan = $${values.length}`);
        }

        if (query.jenis_pekerjaan) {
            values.push(query.jenis_pekerjaan);
            conditions.push(`jenis_pekerjaan = $${values.length}`);
        }

        if (query.status) {
            values.push(query.status);
            conditions.push(`status = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query<PengawasanRow>(
            `
            SELECT id, id_gantt, kategori_pekerjaan, jenis_pekerjaan, status, created_at
            FROM pengawasan
            ${whereClause}
            ORDER BY id DESC
            `,
            values
        );

        return result.rows;
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
            RETURNING id, id_gantt, kategori_pekerjaan, jenis_pekerjaan, status, created_at
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
    }
};
