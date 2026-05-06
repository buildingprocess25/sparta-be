import { pool, withTransaction } from "../../db/pool";
import type {
    PenyimpananDokumenCreateInput,
    PenyimpananDokumenListQueryInput,
    PenyimpananDokumenUpdateInput
} from "./document.schema";

export type PenyimpananDokumenRow = {
    id: number;
    id_toko: number;
    nama_dokumen: string;
    drive_file_id: string | null;
    drive_folder_id: string | null;
    link_dokumen: string | null;
    link_folder: string | null;
    created_at: string;
};

export type TokoRow = {
    id: number;
    nama_toko: string | null;
    cabang: string | null;
    kode_toko: string | null;
};

export const penyimpananDokumenRepository = {
    async findTokoById(idToko: number): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `
            SELECT id, nama_toko, cabang, kode_toko
            FROM toko
            WHERE id = $1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async createBulk(
        input: PenyimpananDokumenCreateInput,
        linkFolder: string | null,
        driveFolderId: string | null,
        items: Array<{ link: string; driveFileId?: string }>
    ): Promise<PenyimpananDokumenRow[]> {
        if (items.length === 0) return [];

        return withTransaction(async (client) => {
            const values: Array<number | string | null> = [];
            const placeholders = items.map((item, index) => {
                const base = index * 6;
                values.push(
                    input.id_toko,
                    input.nama_dokumen,
                    item.driveFileId ?? null,
                    driveFolderId,
                    item.link,
                    linkFolder
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
            });

            const result = await client.query<PenyimpananDokumenRow>(
                `
                INSERT INTO penyimpanan_dokumen (
                    id_toko,
                    nama_dokumen,
                    drive_file_id,
                    drive_folder_id,
                    link_dokumen,
                    link_folder
                )
                VALUES ${placeholders.join(", ")}
                RETURNING id, id_toko, nama_dokumen, drive_file_id, drive_folder_id, link_dokumen, link_folder, created_at
                `,
                values
            );

            return result.rows;
        });
    },

    async list(query: PenyimpananDokumenListQueryInput): Promise<PenyimpananDokumenRow[]> {
        const conditions: string[] = [];
        const values: Array<number | string> = [];

        if (typeof query.id_toko === "number") {
            values.push(query.id_toko);
            conditions.push(`id_toko = $${values.length}`);
        }

        if (query.nama_dokumen) {
            values.push(query.nama_dokumen);
            conditions.push(`LOWER(nama_dokumen) = LOWER($${values.length})`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<PenyimpananDokumenRow>(
            `
            SELECT id, id_toko, nama_dokumen, drive_file_id, drive_folder_id, link_dokumen, link_folder, created_at
            FROM penyimpanan_dokumen
            ${whereClause}
            ORDER BY created_at DESC, id DESC
            `,
            values
        );

        return result.rows;
    },

    async findById(id: number): Promise<PenyimpananDokumenRow | null> {
        const result = await pool.query<PenyimpananDokumenRow>(
            `
            SELECT id, id_toko, nama_dokumen, drive_file_id, drive_folder_id, link_dokumen, link_folder, created_at
            FROM penyimpanan_dokumen
            WHERE id = $1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async update(
        id: number,
        input: PenyimpananDokumenUpdateInput & {
            link_dokumen?: string;
            link_folder?: string | null;
            drive_file_id?: string | null;
            drive_folder_id?: string | null;
        }
    )
        : Promise<PenyimpananDokumenRow | null> {
        const fields: string[] = [];
        const values: Array<string | null> = [];

        const pushField = (column: string, value: string | null | undefined) => {
            if (typeof value === "undefined") return;
            values.push(value ?? null);
            fields.push(`${column} = $${values.length}`);
        };

        pushField("nama_dokumen", input.nama_dokumen);
        pushField("drive_file_id", input.drive_file_id);
        pushField("drive_folder_id", input.drive_folder_id);
        pushField("link_dokumen", input.link_dokumen);
        pushField("link_folder", input.link_folder);

        if (fields.length === 0) {
            return this.findById(id);
        }

        const result = await pool.query<PenyimpananDokumenRow>(
            `
            UPDATE penyimpanan_dokumen
            SET ${fields.join(", ")}
            WHERE id = $${values.length + 1}
            RETURNING id, id_toko, nama_dokumen, drive_file_id, drive_folder_id, link_dokumen, link_folder, created_at
            `,
            [...values, id]
        );

        return result.rows[0] ?? null;
    },

    async delete(id: number): Promise<PenyimpananDokumenRow | null> {
        const result = await pool.query<PenyimpananDokumenRow>(
            `
            DELETE FROM penyimpanan_dokumen
            WHERE id = $1
            RETURNING id, id_toko, nama_dokumen, drive_file_id, drive_folder_id, link_dokumen, link_folder, created_at
            `,
            [id]
        );

        return result.rows[0] ?? null;
    }
};
