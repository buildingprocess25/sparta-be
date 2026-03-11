import { pool } from "../../db/pool";
import type { CreateTokoInput } from "./toko.schema";

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

    async findAll(search?: string): Promise<TokoRow[]> {
        if (!search) {
            const result = await pool.query<TokoRow>(
                `SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor FROM toko ORDER BY nama_toko ASC`
            );
            return result.rows;
        }

        const keyword = `%${search}%`;
        const result = await pool.query<TokoRow>(
            `
      SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, proyek, cabang, alamat, nama_kontraktor
      FROM toko
      WHERE nomor_ulok ILIKE $1 OR nama_toko ILIKE $1 OR kode_toko ILIKE $1 OR cabang ILIKE $1
      ORDER BY nama_toko ASC
      `,
            [keyword]
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
