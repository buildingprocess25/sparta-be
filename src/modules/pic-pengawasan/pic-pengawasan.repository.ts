import { pool } from "../../db/pool";
import type { CreatePicPengawasanInput, ListPicPengawasanQueryInput } from "./pic-pengawasan.schema";

export type PicPengawasanRow = {
    id: number;
    nomor_ulok: string;
    id_rab: number;
    id_spk: number;
    kategori_lokasi: string;
    durasi: string;
    tanggal_mulai_spk: string;
    plc_building_support: string;
    created_at: string;
};

export const picPengawasanRepository = {
    async create(input: CreatePicPengawasanInput): Promise<PicPengawasanRow> {
        const result = await pool.query<PicPengawasanRow>(
            `
      INSERT INTO pic_pengawasan (
        nomor_ulok,
        id_rab,
        id_spk,
        kategori_lokasi,
        durasi,
        tanggal_mulai_spk,
        plc_building_support
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nomor_ulok, id_rab, id_spk, kategori_lokasi, durasi, tanggal_mulai_spk, plc_building_support, created_at
      `,
            [
                input.nomor_ulok,
                input.id_rab,
                input.id_spk,
                input.kategori_lokasi,
                input.durasi,
                input.tanggal_mulai_spk,
                input.plc_building_support
            ]
        );

        return result.rows[0];
    },

    async findById(id: string): Promise<PicPengawasanRow | null> {
        const result = await pool.query<PicPengawasanRow>(
            `
      SELECT id, nomor_ulok, id_rab, id_spk, kategori_lokasi, durasi, tanggal_mulai_spk, plc_building_support, created_at
      FROM pic_pengawasan
      WHERE id = $1
      `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async findAll(query: ListPicPengawasanQueryInput): Promise<PicPengawasanRow[]> {
        const filters: string[] = [];
        const values: Array<string | number> = [];

        if (query.nomor_ulok) {
            values.push(query.nomor_ulok);
            filters.push(`nomor_ulok = $${values.length}`);
        }

        if (typeof query.id_rab !== "undefined") {
            values.push(query.id_rab);
            filters.push(`id_rab = $${values.length}`);
        }

        if (typeof query.id_spk !== "undefined") {
            values.push(query.id_spk);
            filters.push(`id_spk = $${values.length}`);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const result = await pool.query<PicPengawasanRow>(
            `
      SELECT id, nomor_ulok, id_rab, id_spk, kategori_lokasi, durasi, tanggal_mulai_spk, plc_building_support, created_at
      FROM pic_pengawasan
      ${whereClause}
      ORDER BY id DESC
      `,
            values
        );

        return result.rows;
    }
};