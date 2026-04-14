import { pool, withTransaction } from "../../db/pool";
import type {
    CreateOpnameData,
    ListOpnameQueryInput,
    UpdateOpnameInput
} from "./opname.schema";

export type OpnameRow = {
    id: number;
    id_toko: number;
    id_rab_item: number;
    volume_akhir: number;
    selisih_volume: number;
    total_selisih: number;
    desain: string | null;
    kualitas: string | null;
    spesifikasi: string | null;
    foto: string | null;
    catatan: string | null;
    created_at: string;
};

const returningColumns = `
    id,
    id_toko,
    id_rab_item,
    volume_akhir,
    selisih_volume,
    total_selisih,
    desain,
    kualitas,
    spesifikasi,
    foto,
    catatan,
    created_at
`;

export const opnameRepository = {
    async create(input: CreateOpnameData): Promise<OpnameRow> {
        const result = await pool.query<OpnameRow>(
            `
            INSERT INTO opname (
                id_toko,
                id_rab_item,
                volume_akhir,
                selisih_volume,
                total_selisih,
                desain,
                kualitas,
                spesifikasi,
                foto,
                catatan
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING ${returningColumns}
            `,
            [
                input.id_toko,
                input.id_rab_item,
                input.volume_akhir,
                input.selisih_volume,
                input.total_selisih,
                input.desain ?? null,
                input.kualitas ?? null,
                input.spesifikasi ?? null,
                input.foto ?? null,
                input.catatan ?? null
            ]
        );

        return result.rows[0];
    },

    async createBulk(items: CreateOpnameData[]): Promise<OpnameRow[]> {
        return withTransaction(async (client) => {
            const values: Array<number | string | null> = [];
            const placeholders = items.map((item, index) => {
                const base = index * 10;
                values.push(
                    item.id_toko,
                    item.id_rab_item,
                    item.volume_akhir,
                    item.selisih_volume,
                    item.total_selisih,
                    item.desain ?? null,
                    item.kualitas ?? null,
                    item.spesifikasi ?? null,
                    item.foto ?? null,
                    item.catatan ?? null
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
            });

            const result = await client.query<OpnameRow>(
                `
                INSERT INTO opname (
                    id_toko,
                    id_rab_item,
                    volume_akhir,
                    selisih_volume,
                    total_selisih,
                    desain,
                    kualitas,
                    spesifikasi,
                    foto,
                    catatan
                )
                VALUES ${placeholders.join(", ")}
                RETURNING ${returningColumns}
                `,
                values
            );

            return result.rows;
        });
    },

    async findById(id: string): Promise<OpnameRow | null> {
        const result = await pool.query<OpnameRow>(
            `
            SELECT ${returningColumns}
            FROM opname
            WHERE id = $1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async findAll(query: ListOpnameQueryInput): Promise<OpnameRow[]> {
        const conditions: string[] = [];
        const values: Array<number | string> = [];

        if (typeof query.id_toko !== "undefined") {
            values.push(query.id_toko);
            conditions.push(`id_toko = $${values.length}`);
        }

        if (typeof query.id_rab_item !== "undefined") {
            values.push(query.id_rab_item);
            conditions.push(`id_rab_item = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query<OpnameRow>(
            `
            SELECT ${returningColumns}
            FROM opname
            ${whereClause}
            ORDER BY id DESC
            `,
            values
        );

        return result.rows;
    },

    async updateById(id: string, input: UpdateOpnameInput): Promise<OpnameRow | null> {
        const setClauses: string[] = [];
        const values: Array<number | string | null> = [];

        if (typeof input.id_toko !== "undefined") {
            values.push(input.id_toko);
            setClauses.push(`id_toko = $${values.length}`);
        }

        if (typeof input.id_rab_item !== "undefined") {
            values.push(input.id_rab_item);
            setClauses.push(`id_rab_item = $${values.length}`);
        }

        if (typeof input.volume_akhir !== "undefined") {
            values.push(input.volume_akhir);
            setClauses.push(`volume_akhir = $${values.length}`);
        }

        if (typeof input.selisih_volume !== "undefined") {
            values.push(input.selisih_volume);
            setClauses.push(`selisih_volume = $${values.length}`);
        }

        if (typeof input.total_selisih !== "undefined") {
            values.push(input.total_selisih);
            setClauses.push(`total_selisih = $${values.length}`);
        }

        if (typeof input.desain !== "undefined") {
            values.push(input.desain);
            setClauses.push(`desain = $${values.length}`);
        }

        if (typeof input.kualitas !== "undefined") {
            values.push(input.kualitas);
            setClauses.push(`kualitas = $${values.length}`);
        }

        if (typeof input.spesifikasi !== "undefined") {
            values.push(input.spesifikasi);
            setClauses.push(`spesifikasi = $${values.length}`);
        }

        if (typeof input.foto !== "undefined") {
            values.push(input.foto);
            setClauses.push(`foto = $${values.length}`);
        }

        if (typeof input.catatan !== "undefined") {
            values.push(input.catatan);
            setClauses.push(`catatan = $${values.length}`);
        }

        values.push(id);

        const result = await pool.query<OpnameRow>(
            `
            UPDATE opname
            SET ${setClauses.join(", ")}
            WHERE id = $${values.length}
            RETURNING ${returningColumns}
            `,
            values
        );

        return result.rows[0] ?? null;
    },

    async deleteById(id: string): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM opname WHERE id = $1`,
            [id]
        );

        return (result.rowCount ?? 0) > 0;
    }
};
