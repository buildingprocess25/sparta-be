import { pool, withTransaction } from "../../db/pool";
import type {
    PenyimpananDokumenCreateInput,
    PenyimpananDokumenListQueryInput,
    PenyimpananDokumenUpdateInput
} from "./document.schema";

export type PenyimpananDokumenRow = {
    id: number;
    id_toko: number | null;
    nama_dokumen: string;
    drive_file_id: string | null;
    drive_folder_id: string | null;
    link_dokumen: string | null;
    link_folder: string | null;
    kode_toko: string | null;
    nama_toko: string | null;
    cabang: string | null;
    kategori_dokumen: string | null;
    source_timestamp: string | null;
    source_last_edit: string | null;
    migrated_at: string | null;
    created_at: string;
};

export type PenyimpananDokumenMigrationItem = {
    kode_toko: string | null;
    nama_toko: string | null;
    cabang: string | null;
    kategori_dokumen: string;
    nama_dokumen: string;
    drive_file_id: string | null;
    drive_folder_id: string | null;
    link_dokumen: string;
    link_folder: string | null;
    source_timestamp: Date | null;
    source_last_edit: Date | null;
};

export type PenyimpananDokumenArchiveStoreRow = {
    kode_toko: string | null;
    nama_toko: string | null;
    cabang: string | null;
    jumlah_dokumen: number;
    last_created_at: string | null;
};

export type TokoRow = {
    id: number;
    nama_toko: string | null;
    cabang: string | null;
    kode_toko: string | null;
};

const SELECT_COLUMNS = `
    id, id_toko, nama_dokumen, drive_file_id, drive_folder_id, link_dokumen, link_folder,
    kode_toko, nama_toko, cabang, kategori_dokumen, source_timestamp, source_last_edit,
    migrated_at, created_at
`;

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
                RETURNING ${SELECT_COLUMNS}
                `,
                values
            );

            return result.rows;
        });
    },

    async list(query: PenyimpananDokumenListQueryInput): Promise<PenyimpananDokumenRow[]> {
        const conditions: string[] = [];
        const values: Array<number | string> = [];
        const tokoIdentity: string[] = [];

        if (typeof query.id_toko === "number") {
            values.push(query.id_toko);
            tokoIdentity.push(`id_toko = $${values.length}`);
        }

        if (query.kode_toko) {
            values.push(query.kode_toko);
            tokoIdentity.push(`LOWER(kode_toko) = LOWER($${values.length})`);
        }

        if (query.nama_toko && query.cabang) {
            values.push(query.nama_toko);
            const namaParam = values.length;
            values.push(query.cabang);
            const cabangParam = values.length;
            tokoIdentity.push(`(LOWER(nama_toko) = LOWER($${namaParam}) AND LOWER(cabang) = LOWER($${cabangParam}))`);
        } else if (query.nama_toko) {
            values.push(query.nama_toko);
            tokoIdentity.push(`LOWER(nama_toko) = LOWER($${values.length})`);
        }

        if (tokoIdentity.length > 0) {
            conditions.push(`(${tokoIdentity.join(" OR ")})`);
        }

        if (query.nama_dokumen) {
            values.push(query.nama_dokumen);
            conditions.push(`(LOWER(nama_dokumen) = LOWER($${values.length}) OR LOWER(kategori_dokumen) = LOWER($${values.length}))`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<PenyimpananDokumenRow>(
            `
            SELECT ${SELECT_COLUMNS}
            FROM penyimpanan_dokumen
            ${whereClause}
            ORDER BY created_at DESC, id DESC
            `,
            values
        );

        return result.rows;
    },

    async listArchiveStores(search?: string): Promise<PenyimpananDokumenArchiveStoreRow[]> {
        const trimmedSearch = String(search ?? "").trim();
        if (trimmedSearch.length < 2) return [];

        const keyword = `%${trimmedSearch}%`;
        const result = await pool.query<PenyimpananDokumenArchiveStoreRow>(
            `
            SELECT
                pd.kode_toko,
                pd.nama_toko,
                pd.cabang,
                COUNT(*)::int AS jumlah_dokumen,
                MAX(pd.created_at)::text AS last_created_at
            FROM penyimpanan_dokumen pd
            WHERE pd.id_toko IS NULL
              AND (pd.kode_toko IS NOT NULL OR pd.nama_toko IS NOT NULL)
              AND (
                  pd.kode_toko ILIKE $1
                  OR pd.nama_toko ILIKE $1
                  OR pd.cabang ILIKE $1
              )
            GROUP BY pd.kode_toko, pd.nama_toko, pd.cabang
            ORDER BY jumlah_dokumen DESC, pd.nama_toko ASC
            LIMIT 100
            `,
            [keyword]
        );

        return result.rows;
    },

    async findById(id: number): Promise<PenyimpananDokumenRow | null> {
        const result = await pool.query<PenyimpananDokumenRow>(
            `
            SELECT ${SELECT_COLUMNS}
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
            RETURNING ${SELECT_COLUMNS}
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
            RETURNING ${SELECT_COLUMNS}
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async insertMigratedDocuments(items: PenyimpananDokumenMigrationItem[]): Promise<{ inserted: number }> {
        if (items.length === 0) return { inserted: 0 };

        const chunkSize = 500;
        let inserted = 0;

        for (let offset = 0; offset < items.length; offset += chunkSize) {
            const chunk = items.slice(offset, offset + chunkSize);
            const values: Array<string | Date | null> = [];
            const placeholders = chunk.map((item, index) => {
                const base = index * 11;
                values.push(
                    item.kode_toko,
                    item.nama_toko,
                    item.cabang,
                    item.kategori_dokumen,
                    item.nama_dokumen,
                    item.drive_file_id,
                    item.drive_folder_id,
                    item.link_dokumen,
                    item.link_folder,
                    item.source_timestamp,
                    item.source_last_edit
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, CURRENT_TIMESTAMP)`;
            });

            const result = await pool.query<{ id: number }>(
                `
                INSERT INTO penyimpanan_dokumen (
                    kode_toko, nama_toko, cabang, kategori_dokumen, nama_dokumen,
                    drive_file_id, drive_folder_id, link_dokumen, link_folder,
                    source_timestamp, source_last_edit, migrated_at
                )
                VALUES ${placeholders.join(", ")}
                ON CONFLICT (kode_toko, cabang, kategori_dokumen, nama_dokumen, link_dokumen)
                WHERE kode_toko IS NOT NULL AND link_dokumen IS NOT NULL
                DO NOTHING
                RETURNING id
                `,
                values
            );
            inserted += result.rowCount ?? 0;
        }

        return { inserted };
    }
};
