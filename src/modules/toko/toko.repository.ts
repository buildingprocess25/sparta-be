import { pool } from "../../db/pool";
import type { CreateTokoInput, ListTokoQueryInput } from "./toko.schema";

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

export const tokoRepository = {
    async create(input: CreateTokoInput): Promise<TokoRow> {
        const result = await pool.query<TokoRow>(
            `
      INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (nomor_ulok) DO UPDATE
        SET nama_toko = EXCLUDED.nama_toko,
            kode_toko = EXCLUDED.kode_toko,
            cabang = EXCLUDED.cabang,
            alamat = EXCLUDED.alamat
      RETURNING id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
      `,
            [input.nomor_ulok, input.nama_toko, input.kode_toko, input.cabang, input.alamat]
        );

        return result.rows[0];
    },

    async findByNomorUlok(nomorUlok: string): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor FROM toko WHERE nomor_ulok = $1`,
            [nomorUlok]
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
      WHERE LOWER(email_sat) = LOWER($1)
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
      WHERE LOWER(email_sat) = LOWER($1)
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
      WHERE LOWER(email_sat) = LOWER($1)
        AND LOWER(cabang) = LOWER($2)
      LIMIT 1
      `,
            [emailSat, cabang]
        );

        return result.rows[0] ?? null;
    }
};
