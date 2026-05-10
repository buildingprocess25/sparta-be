import { pool } from "../../db/pool";
import type { CreateTokoInput, ListTokoQueryInput, GetTokoDetailQueryInput, UpdateTokoByIdBodyInput } from "./toko.schema";

export type TokoRow = {
    id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string | null;
    nama_toko: string;
    kode_toko: string;
    proyek: string | null;
    cabang: string;
    alamat: string;
    nama_kontraktor: string | null;
};

export type UserCabangRow = {
    cabang: string;
    nama_lengkap: string;
    jabatan: string;
    email_sat: string;
    nama_pt: string;
};

export type AlamatCabangRow = {
    cabang: string;
    alamat: string;
};

export const tokoRepository = {
    async create(input: CreateTokoInput): Promise<TokoRow> {
        const existing = await pool.query<TokoRow>(
            `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
             FROM toko
             WHERE nomor_ulok = $1
             ORDER BY id DESC
             LIMIT 1`,
            [input.nomor_ulok]
        );

        if ((existing.rowCount ?? 0) > 0) {
            const updated = await pool.query<TokoRow>(
                `UPDATE toko
                 SET nama_toko = $1,
                     kode_toko = $2,
                     cabang = $3,
                     alamat = $4
                 WHERE id = $5
                 RETURNING id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor`,
                [
                    input.nama_toko,
                    input.kode_toko,
                    input.cabang,
                    input.alamat,
                    existing.rows[0].id
                ]
            );
            return updated.rows[0];
        }

        const inserted = await pool.query<TokoRow>(
            `INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor`,
            [input.nomor_ulok, input.nama_toko, input.kode_toko, input.cabang, input.alamat]
        );

        return inserted.rows[0];
    },

    async findByNomorUlok(nomorUlok: string): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
             FROM toko
             WHERE nomor_ulok = $1
             ORDER BY id DESC
             LIMIT 1`,
            [nomorUlok]
        );

        return result.rows[0] ?? null;
    },

    async findByNomorUlokAndLingkup(nomorUlok: string, lingkupPekerjaan?: string | null): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
             FROM toko
             WHERE nomor_ulok = $1
               AND LOWER(COALESCE(lingkup_pekerjaan, '')) = LOWER(COALESCE($2, ''))
             ORDER BY id DESC
             LIMIT 1`,
            [nomorUlok, lingkupPekerjaan ?? null]
        );

        return result.rows[0] ?? null;
    },

    async findById(id: number): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor FROM toko WHERE id = $1`,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async findDetail(query: GetTokoDetailQueryInput): Promise<TokoRow | null> {
        const filters: string[] = [];
        const values: any[] = [];

        if (query.id) {
            values.push(query.id);
            filters.push(`id = $${values.length}`);
        }
        if (query.nomor_ulok) {
            values.push(query.nomor_ulok);
            filters.push(`nomor_ulok = $${values.length}`);
        }
        if (query.lingkup) {
            values.push(query.lingkup);
            filters.push(`LOWER(lingkup_pekerjaan) = LOWER($${values.length})`);
        }

        if (filters.length === 0) return null;

        const result = await pool.query<TokoRow>(
            `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor 
             FROM toko 
             WHERE ${filters.join(" AND ")}
             LIMIT 1`,
            values
        );

        return result.rows[0] ?? null;
    },

    async updateById(id: number, input: UpdateTokoByIdBodyInput): Promise<TokoRow | null> {
        const updates: string[] = [];
        const values: Array<string | number | null> = [];

        if (input.nomor_ulok !== undefined) {
            values.push(input.nomor_ulok);
            updates.push(`nomor_ulok = $${values.length}`);
        }
        if (input.nama_toko !== undefined) {
            values.push(input.nama_toko);
            updates.push(`nama_toko = $${values.length}`);
        }
        if (input.kode_toko !== undefined) {
            values.push(input.kode_toko);
            updates.push(`kode_toko = $${values.length}`);
        }
        if (input.cabang !== undefined) {
            values.push(input.cabang);
            updates.push(`cabang = $${values.length}`);
        }
        if (input.alamat !== undefined) {
            values.push(input.alamat);
            updates.push(`alamat = $${values.length}`);
        }

        if (updates.length === 0) {
            return null;
        }

        values.push(id);
        const result = await pool.query<TokoRow>(
            `UPDATE toko
             SET ${updates.join(", ")}
             WHERE id = $${values.length}
             RETURNING id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor`,
            values
        );

        return result.rows[0] ?? null;
    },

    async updateKodeTokoByUlokAndLingkup(
        nomorUlok: string,
        lingkupPekerjaan: string,
        kodeToko: string
    ): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `
      UPDATE toko
      SET kode_toko = $3,
          lingkup_pekerjaan = COALESCE(lingkup_pekerjaan, $2)
      WHERE nomor_ulok = $1
        AND (
            LOWER(COALESCE(lingkup_pekerjaan, '')) = LOWER(COALESCE($2, ''))
            OR lingkup_pekerjaan IS NULL
        )
      RETURNING id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
      `,
            [nomorUlok, lingkupPekerjaan, kodeToko]
        );

        return result.rows[0] ?? null;
    },

    async findAll(query: ListTokoQueryInput): Promise<TokoRow[]> {
        const { search, cabang } = query;
        const filters: string[] = [];
        const values: string[] = [];

        if (search) {
            values.push(`%${search}%`);
            const searchIndex = values.length;
            filters.push(
                `(nomor_ulok ILIKE $${searchIndex} OR nama_toko ILIKE $${searchIndex} OR kode_toko ILIKE $${searchIndex} OR cabang ILIKE $${searchIndex})`
            );
        }

        if (cabang) {
            values.push(cabang);
            const cabangIndex = values.length;
            filters.push(`LOWER(cabang) = LOWER($${cabangIndex})`);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const result = await pool.query<TokoRow>(
            `
      SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
      FROM toko
      ${whereClause}
      ORDER BY nama_toko ASC
      `,
            values
        );

        return result.rows;
    },

    async findUserCabangByEmailSat(emailSat: string): Promise<UserCabangRow | null> {
        const result = await pool.query<UserCabangRow>(
            `
      SELECT cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      WHERE LOWER(email_sat) LIKE '%' || LOWER($1) || '%'
      LIMIT 1
      `,
            [emailSat]
        );

        return result.rows[0] ?? null;
    },

    async findUserCabangByEmailSatAll(emailSat: string): Promise<UserCabangRow[]> {
        const result = await pool.query<UserCabangRow>(
            `
      SELECT cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      WHERE LOWER(email_sat) LIKE '%' || LOWER($1) || '%'
      ORDER BY jabatan ASC
      `,
            [emailSat]
        );

        return result.rows;
    },

    async findUserCabangByEmailSatAndCabang(emailSat: string, cabang: string): Promise<UserCabangRow | null> {
        const result = await pool.query<UserCabangRow>(
            `
      SELECT cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      WHERE LOWER(email_sat) LIKE '%' || LOWER($1) || '%'
        AND LOWER(cabang) = LOWER($2)
      LIMIT 1
      `,
            [emailSat, cabang]
        );

        return result.rows[0] ?? null;
    },

    async findAlamatCabangByCabang(cabang: string): Promise<AlamatCabangRow | null> {
        const trimmed = cabang.trim();
        if (!trimmed) return null;

        const result = await pool.query<AlamatCabangRow>(
            `
      SELECT cabang, alamat
      FROM alamat_cabang
      WHERE LOWER(cabang) = LOWER($1)
      LIMIT 1
      `,
            [trimmed]
        );

        return result.rows[0] ?? null;
    }
};
