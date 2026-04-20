import { pool, withTransaction } from "../../db/pool";
import type {
    CreateBulkOpnameItemData,
    CreateOpnameData,
    ListOpnameQueryInput,
    UpdateOpnameInput
} from "./opname.schema";

export type OpnameRow = {
    id: number;
    id_toko: number;
    id_opname_final: number;
    id_rab_item: number;
    status: "pending" | "disetujui" | "ditolak";
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

export type OpnameFinalHeaderRow = {
    id: number;
    id_toko: number;
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

const returningColumns = `
    id,
    id_toko,
    id_opname_final,
    id_rab_item,
    status,
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

const opnameFinalColumns = `
    id,
    id_toko,
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
`;

export const opnameRepository = {
    async create(input: CreateOpnameData): Promise<OpnameRow> {
        const result = await pool.query<OpnameRow>(
            `
            INSERT INTO opname_item (
                id_toko,
                id_opname_final,
                id_rab_item,
                status,
                volume_akhir,
                selisih_volume,
                total_selisih,
                desain,
                kualitas,
                spesifikasi,
                foto,
                catatan
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING ${returningColumns}
            `,
            [
                input.id_toko,
                input.id_opname_final,
                input.id_rab_item,
                input.status ?? "pending",
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

    async createBulkWithFinal(payload: {
        id_toko: number;
        email_pembuat: string;
        items: CreateBulkOpnameItemData[];
    }): Promise<{ opnameFinal: OpnameFinalHeaderRow; items: OpnameRow[] }> {
        return withTransaction(async (client) => {
            const finalResult = await client.query<OpnameFinalHeaderRow>(
                `
                INSERT INTO opname_final (
                    id_toko,
                    email_pembuat
                )
                VALUES ($1, $2)
                RETURNING ${opnameFinalColumns}
                `,
                [payload.id_toko, payload.email_pembuat]
            );

            const opnameFinal = finalResult.rows[0];
            const values: Array<number | string | null> = [];
            const placeholders = payload.items.map((item, index) => {
                const base = index * 12;
                values.push(
                    payload.id_toko,
                    opnameFinal.id,
                    item.id_rab_item,
                    item.status ?? "pending",
                    item.volume_akhir,
                    item.selisih_volume,
                    item.total_selisih,
                    item.desain ?? null,
                    item.kualitas ?? null,
                    item.spesifikasi ?? null,
                    item.foto ?? null,
                    item.catatan ?? null
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
            });

            const result = await client.query<OpnameRow>(
                `
                INSERT INTO opname_item (
                    id_toko,
                    id_opname_final,
                    id_rab_item,
                    status,
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

            const totals = await client.query<{ grand_total_opname: string; grand_total_rab: string }>(
                `
                SELECT
                    COALESCE(SUM(oi.total_selisih), 0)::text AS grand_total_opname,
                    COALESCE(SUM(ri.total_harga), 0)::text AS grand_total_rab
                FROM opname_item oi
                JOIN rab_item ri ON ri.id = oi.id_rab_item
                WHERE oi.id_opname_final = $1
                `,
                [opnameFinal.id]
            );

            await client.query(
                `
                UPDATE opname_final
                SET grand_total_opname = $1,
                    grand_total_rab = $2
                WHERE id = $3
                `,
                [
                    totals.rows[0]?.grand_total_opname ?? "0",
                    totals.rows[0]?.grand_total_rab ?? "0",
                    opnameFinal.id
                ]
            );

            const refreshedFinal = await client.query<OpnameFinalHeaderRow>(
                `
                SELECT ${opnameFinalColumns}
                FROM opname_final
                WHERE id = $1
                `,
                [opnameFinal.id]
            );

            return {
                opnameFinal: refreshedFinal.rows[0],
                items: result.rows
            };
        });
    },

    async findById(id: string): Promise<OpnameRow | null> {
        const result = await pool.query<OpnameRow>(
            `
            SELECT ${returningColumns}
            FROM opname_item
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

        if (typeof query.id_opname_final !== "undefined") {
            values.push(query.id_opname_final);
            conditions.push(`id_opname_final = $${values.length}`);
        }

        if (typeof query.id_rab_item !== "undefined") {
            values.push(query.id_rab_item);
            conditions.push(`id_rab_item = $${values.length}`);
        }

        if (typeof query.status !== "undefined") {
            values.push(query.status);
            conditions.push(`status = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query<OpnameRow>(
            `
            SELECT ${returningColumns}
            FROM opname_item
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

        if (typeof input.id_opname_final !== "undefined") {
            values.push(input.id_opname_final);
            setClauses.push(`id_opname_final = $${values.length}`);
        }

        if (typeof input.id_rab_item !== "undefined") {
            values.push(input.id_rab_item);
            setClauses.push(`id_rab_item = $${values.length}`);
        }

        if (typeof input.status !== "undefined") {
            values.push(input.status);
            setClauses.push(`status = $${values.length}`);
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
            UPDATE opname_item
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
            `DELETE FROM opname_item WHERE id = $1`,
            [id]
        );

        return (result.rowCount ?? 0) > 0;
    }
};
