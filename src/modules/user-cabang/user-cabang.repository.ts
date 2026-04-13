import { pool } from "../../db/pool";
import type { CreateUserCabangInput, ListUserCabangQueryInput, UpdateUserCabangInput } from "./user-cabang.schema";

export type UserCabangRow = {
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
      RETURNING cabang, nama_lengkap, jabatan, email_sat, nama_pt
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

    async findByKey(cabang: string, emailSat: string): Promise<UserCabangRow | null> {
        const result = await pool.query<UserCabangRow>(
            `
      SELECT cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      WHERE LOWER(cabang) = LOWER($1)
        AND LOWER(email_sat) = LOWER($2)
      `,
            [cabang, emailSat]
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
      SELECT cabang, nama_lengkap, jabatan, email_sat, nama_pt
      FROM user_cabang
      ${whereClause}
      ORDER BY cabang ASC, nama_lengkap ASC, email_sat ASC
      `,
            values
        );

        return result.rows;
    },

    async updateByKey(cabang: string, emailSat: string, input: UpdateUserCabangInput): Promise<UserCabangRow | null> {
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

                values.push(cabang);
                values.push(emailSat);
        const result = await pool.query<UserCabangRow>(
            `
      UPDATE user_cabang
      SET ${setParts.join(", ")}
            WHERE LOWER(cabang) = LOWER($${values.length - 1})
                AND LOWER(email_sat) = LOWER($${values.length})
            RETURNING cabang, nama_lengkap, jabatan, email_sat, nama_pt
      `,
            values
        );

        return result.rows[0] ?? null;
    },

        async deleteByKey(cabang: string, emailSat: string): Promise<UserCabangRow | null> {
        const result = await pool.query<UserCabangRow>(
            `
      DELETE FROM user_cabang
            WHERE LOWER(cabang) = LOWER($1)
                AND LOWER(email_sat) = LOWER($2)
            RETURNING cabang, nama_lengkap, jabatan, email_sat, nama_pt
      `,
                        [cabang, emailSat]
        );

        return result.rows[0] ?? null;
    }
};
