import { pool } from "../../db/pool";
import type { CreateTokoInput } from "./toko.schema";

export type TokoRow = {
    nomor_ulok: string;
    nama_toko: string;
    kode_toko: string;
    cabang: string;
    alamat: string;
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
      RETURNING nomor_ulok, nama_toko, kode_toko, cabang, alamat
      `,
            [input.nomor_ulok, input.nama_toko, input.kode_toko, input.cabang, input.alamat]
        );

        return result.rows[0];
    },

    async findByNomorUlok(nomorUlok: string): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `SELECT nomor_ulok, nama_toko, kode_toko, cabang, alamat FROM toko WHERE nomor_ulok = $1`,
            [nomorUlok]
        );

        return result.rows[0] ?? null;
    },

    async findAll(search?: string): Promise<TokoRow[]> {
        if (!search) {
            const result = await pool.query<TokoRow>(
                `SELECT nomor_ulok, nama_toko, kode_toko, cabang, alamat FROM toko ORDER BY nama_toko ASC`
            );
            return result.rows;
        }

        const keyword = `%${search}%`;
        const result = await pool.query<TokoRow>(
            `
      SELECT nomor_ulok, nama_toko, kode_toko, cabang, alamat
      FROM toko
      WHERE nomor_ulok ILIKE $1 OR nama_toko ILIKE $1 OR kode_toko ILIKE $1 OR cabang ILIKE $1
      ORDER BY nama_toko ASC
      `,
            [keyword]
        );

        return result.rows;
    }
};
