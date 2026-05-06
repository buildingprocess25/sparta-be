import { pool } from "../../db/pool";
import type { CreateUserCabangInput, ListUserCabangQueryInput, UpdateUserCabangInput } from "./user-cabang.schema";

export type UserCabangRow = {
    id: number;
    cabang: string;
    nama_lengkap: string | null;
    jabatan: string | null;
    email_sat: string;
    nama_pt: string | null;
};

export const userCabangRepository = {
    async create(input: CreateUserCabangInput): Promise<UserCabangRow> {
        const result = await pool.query<UserCabangRow>(
            `
      INSERT INTO user_cabang (cabang, nama_lengkap, jabatan, email_sat, nama_pt)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
      `,
            [
                input.cabang,
                input.nama_lengkap ?? null,
                input.jabatan ?? null,
                input.email_sat,
                input.nama_pt ?? null
            ]
        );

        return result.rows[0];
    },

    async findById(id: number): Promise<UserCabangRow | null> {
        const result = await pool.query<UserCabangRow>(
            `
      SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      WHERE id = $1
      `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async findAll(query: ListUserCabangQueryInput): Promise<UserCabangRow[]> {
        const filters: string[] = [];
        const values: string[] = [];

        if (query.search) {
            values.push(`%${query.search}%`);
            const index = values.length;
            filters.push(`(
                cabang ILIKE $${index}
                OR nama_lengkap ILIKE $${index}
                OR jabatan ILIKE $${index}
                OR email_sat ILIKE $${index}
                OR nama_pt ILIKE $${index}
            )`);
        }

        if (query.cabang) {
            values.push(query.cabang);
            filters.push(`LOWER(cabang) = LOWER($${values.length})`);
        }

        if (query.email_sat) {
            values.push(query.email_sat);
            filters.push(`LOWER(email_sat) = LOWER($${values.length})`);
        }

        if (query.jabatan) {
            values.push(query.jabatan);
            filters.push(`LOWER(jabatan) = LOWER($${values.length})`);
        }

        if (query.nama_pt) {
            values.push(query.nama_pt);
            filters.push(`LOWER(nama_pt) = LOWER($${values.length})`);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const result = await pool.query<UserCabangRow>(
            `
            SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      ${whereClause}
      ORDER BY cabang ASC, nama_lengkap ASC, email_sat ASC
      `,
            values
        );

        return result.rows;
    },

    async updateById(id: number, input: UpdateUserCabangInput): Promise<UserCabangRow | null> {
        const setParts: string[] = [];
        const values: Array<string | number | null> = [];

        if (typeof input.cabang !== "undefined") {
            values.push(input.cabang);
            setParts.push(`cabang = $${values.length}`);
        }

        if (typeof input.email_sat !== "undefined") {
            values.push(input.email_sat);
            setParts.push(`email_sat = $${values.length}`);
        }

        if (typeof input.nama_lengkap !== "undefined") {
            values.push(input.nama_lengkap);
            setParts.push(`nama_lengkap = $${values.length}`);
        }

        if (typeof input.jabatan !== "undefined") {
            values.push(input.jabatan);
            setParts.push(`jabatan = $${values.length}`);
        }

        if (typeof input.nama_pt !== "undefined") {
            values.push(input.nama_pt);
            setParts.push(`nama_pt = $${values.length}`);
        }

        values.push(id);
        const result = await pool.query<UserCabangRow>(
            `
      UPDATE user_cabang
      SET ${setParts.join(", ")}
            WHERE id = $${values.length}
            RETURNING id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
      `,
            values
        );

        return result.rows[0] ?? null;
    },

    /**
     * Cari user berdasarkan cabang dan jabatan.
     * Mengembalikan satu user pertama yang ditemukan (ORDER BY email_sat ASC LIMIT 1).
     */
    async findByCabangAndJabatan(cabang: string, jabatan: string): Promise<UserCabangRow | null> {
        const result = await pool.query<UserCabangRow>(
            `
      SELECT id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      WHERE LOWER(cabang) = LOWER($1)
        AND LOWER(jabatan) = LOWER($2)
      ORDER BY email_sat ASC
      LIMIT 1
      `,
            [cabang, jabatan]
        );

        return result.rows[0] ?? null;
    },

    async deleteById(id: number): Promise<UserCabangRow | null> {
        const result = await pool.query<UserCabangRow>(
            `
      DELETE FROM user_cabang
            WHERE id = $1
            RETURNING id, cabang, nama_lengkap, jabatan, email_sat, nama_pt
      `,
            [id]
        );

        return result.rows[0] ?? null;
    }
};
