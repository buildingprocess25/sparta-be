import { pool } from "../../db/pool";

export type BerkasSerahTerimaRow = {
    id: number;
    id_toko: number;
    link_pdf: string | null;
    created_at: string;
};

export type BerkasSerahTerimaWithTokoRow = BerkasSerahTerimaRow & {
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    proyek: string | null;
    cabang: string | null;
    alamat: string | null;
    nama_kontraktor: string | null;
    nilai_penawaran: string | null;
    nilai_spk: string | null;
    nilai_opname: string | null;
    hari_denda: number | null;
    nilai_denda: string | null;
    tanggal_akhir_spk_denda: string | null;
    tanggal_serah_terima_denda: string | null;
    nomor_spk: string | null;
};

export type OpnameFinalRow = {
    id: number;
    id_toko: number;
    aksi: string;
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
    hari_denda: number | null;
    nilai_denda: string | null;
    tanggal_akhir_spk_denda: string | null;
    tanggal_serah_terima_denda: string | null;
    created_at: string;
};

export type OpnameItemDetailRow = {
    id: number;
    id_toko: number;
    id_opname_final: number;
    id_rab_item: number;
    status: string;
    volume_akhir: number;
    selisih_volume: number;
    total_selisih: number;
    total_harga_opname: number;
    desain: string | null;
    kualitas: string | null;
    spesifikasi: string | null;
    foto: string | null;
    catatan: string | null;
    created_at: string;
    // joined from rab_item
    kategori_pekerjaan: string | null;
    jenis_pekerjaan: string | null;
    satuan: string | null;
    volume_rab: number | null;
    total_harga_rab: number | null;
};

export type TokoRow = {
    id: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    proyek: string | null;
    cabang: string | null;
    alamat: string | null;
    nama_kontraktor: string | null;
};

export type SerahTerimaDetail = {
    toko: TokoRow;
    opname_final: OpnameFinalRow;
    items: OpnameItemDetailRow[];
};

export type SupervisionCompletionRow = {
    gantt_id: number | null;
    total_checkpoints: number;
    filled_checkpoints: number;
    missing_checkpoints: number;
};

export const serahTerimaRepository = {
    async findTokoById(idToko: number): Promise<TokoRow | null> {
        const result = await pool.query<TokoRow>(
            `
            SELECT
                id,
                nomor_ulok,
                lingkup_pekerjaan,
                nama_toko,
                kode_toko,
                proyek,
                cabang,
                alamat,
                nama_kontraktor
            FROM toko
            WHERE id = $1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async findOpnameFinalByIdToko(idToko: number): Promise<OpnameFinalRow | null> {
        const result = await pool.query<OpnameFinalRow>(
            `
            SELECT
                id,
                id_toko,
                aksi,
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
                hari_denda,
                nilai_denda,
                tanggal_akhir_spk_denda,
                tanggal_serah_terima_denda,
                created_at
            FROM opname_final
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async findOpnameItemsByOpnameFinalId(opnameFinalId: number): Promise<OpnameItemDetailRow[]> {
        const result = await pool.query<OpnameItemDetailRow>(
            `
            SELECT
                oi.id,
                oi.id_toko,
                oi.id_opname_final,
                oi.id_rab_item,
                oi.status,
                oi.volume_akhir,
                oi.selisih_volume,
                oi.total_selisih,
                oi.total_harga_opname,
                oi.desain,
                oi.kualitas,
                oi.spesifikasi,
                COALESCE(NULLIF(oi.foto, ''), latest_pengawasan.dokumentasi_base64, latest_pengawasan.dokumentasi) AS foto,
                oi.catatan,
                oi.created_at,
                ri.kategori_pekerjaan,
                ri.jenis_pekerjaan,
                ri.satuan,
                ri.volume     AS volume_rab,
                ri.total_harga AS total_harga_rab
            FROM opname_item oi
            LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
            LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
            LEFT JOIN LATERAL (
                SELECT
                    p.dokumentasi,
                    p.dokumentasi_base64
                FROM pengawasan p
                LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
                WHERE p.id_gantt = (
                    SELECT g.id
                    FROM gantt_chart g
                    WHERE g.id_toko = oi.id_toko
                    ORDER BY g.id DESC
                    LIMIT 1
                )
                  AND UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(
                        ri.kategori_pekerjaan,
                        ili.kategori_pekerjaan,
                        ''
                  )))
                  AND UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(
                        ri.jenis_pekerjaan,
                        ili.jenis_pekerjaan,
                        ''
                  )))
                  AND (
                      NULLIF(TRIM(COALESCE(p.dokumentasi_base64, '')), '') IS NOT NULL
                      OR NULLIF(TRIM(COALESCE(p.dokumentasi, '')), '') IS NOT NULL
                  )
                ORDER BY
                    to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                    p.id DESC
                LIMIT 1
            ) latest_pengawasan ON true
            WHERE oi.id_opname_final = $1
            ORDER BY oi.id ASC
            `,
            [opnameFinalId]
        );

        return result.rows;
    },

    async getSupervisionCompletionByTokoId(idToko: number): Promise<SupervisionCompletionRow> {
        const result = await pool.query<SupervisionCompletionRow>(
            `
            WITH latest_gantt AS (
                SELECT id
                FROM gantt_chart
                WHERE id_toko = $1
                ORDER BY id DESC
                LIMIT 1
            ),
            latest_pengawasan AS (
                SELECT DISTINCT ON (
                    UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                    UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                )
                    p.kategori_pekerjaan,
                    p.jenis_pekerjaan,
                    p.status
                FROM pengawasan p
                LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
                JOIN latest_gantt g ON g.id = p.id_gantt
                ORDER BY
                    UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                    UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                    to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                    p.id DESC
            )
            SELECT
                (SELECT id FROM latest_gantt) AS gantt_id,
                COUNT(*) FILTER (WHERE lp.status = 'selesai')::int AS total_checkpoints,
                COUNT(*) FILTER (
                    WHERE lp.status = 'selesai'
                      AND EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = $1
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
                      )
                )::int AS filled_checkpoints,
                COUNT(*) FILTER (
                    WHERE lp.status = 'selesai'
                      AND NOT EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = $1
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
                      )
                )::int AS missing_checkpoints
            FROM latest_pengawasan lp
            `,
            [idToko]
        );

        return result.rows[0] ?? {
            gantt_id: null,
            total_checkpoints: 0,
            filled_checkpoints: 0,
            missing_checkpoints: 0,
        };
    },

    async findBerkasSerahTerimaByIdToko(idToko: number): Promise<BerkasSerahTerimaRow | null> {
        const result = await pool.query<BerkasSerahTerimaRow>(
            `
            SELECT id, id_toko, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
            `,
            [idToko]
        );

        return result.rows[0] ?? null;
    },

    async findBerkasSerahTerimaById(id: number): Promise<BerkasSerahTerimaRow | null> {
        const result = await pool.query<BerkasSerahTerimaRow>(
            `
            SELECT id, id_toko, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id = $1
            LIMIT 1
            `,
            [id]
        );

        return result.rows[0] ?? null;
    },

    async listBerkasSerahTerima(filter: { id_toko?: number; nomor_ulok?: string } = {}): Promise<BerkasSerahTerimaWithTokoRow[]> {
        const values: Array<number | string> = [];
        const conditions: string[] = [];

        if (typeof filter.id_toko === "number") {
            values.push(filter.id_toko);
            conditions.push(`bst.id_toko = $${values.length}`);
        }

        if (filter.nomor_ulok) {
            values.push(filter.nomor_ulok);
            conditions.push(`t.nomor_ulok = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query<BerkasSerahTerimaWithTokoRow>(
            `
            SELECT
                bst.id,
                bst.id_toko,
                bst.link_pdf,
                bst.created_at,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.nama_toko,
                t.kode_toko,
                t.proyek,
                t.cabang,
                t.alamat,
                t.nama_kontraktor,
                rab_latest.grand_total_final AS nilai_penawaran,
                spk_latest.grand_total AS nilai_spk,
                opname_latest.grand_total_opname AS nilai_opname,
                opname_latest.hari_denda,
                opname_latest.nilai_denda,
                opname_latest.tanggal_akhir_spk_denda,
                opname_latest.tanggal_serah_terima_denda,
                spk_latest.nomor_spk
            FROM berkas_serah_terima bst
            JOIN toko t ON t.id = bst.id_toko
            LEFT JOIN LATERAL (
                SELECT grand_total_final
                FROM rab
                WHERE id_toko = bst.id_toko
                ORDER BY id DESC
                LIMIT 1
            ) rab_latest ON true
            LEFT JOIN LATERAL (
                SELECT nomor_spk, grand_total
                FROM pengajuan_spk
                WHERE id_toko = bst.id_toko
                  AND UPPER(COALESCE(status, '')) NOT IN ('REJECTED', 'REJECT', 'CANCELLED', 'CANCEL')
                ORDER BY id DESC
                LIMIT 1
            ) spk_latest ON true
            LEFT JOIN LATERAL (
                SELECT grand_total_opname, hari_denda, nilai_denda, tanggal_akhir_spk_denda, tanggal_serah_terima_denda
                FROM opname_final
                WHERE id_toko = bst.id_toko
                ORDER BY id DESC
                LIMIT 1
            ) opname_latest ON true
            ${whereClause}
            ORDER BY bst.created_at DESC, bst.id DESC
            `,
            values
        );

        return result.rows;
    },

    async ensureBerkasSerahTerima(idToko: number): Promise<BerkasSerahTerimaRow> {
        const existing = await pool.query<BerkasSerahTerimaRow>(
            `
            SELECT id, id_toko, link_pdf, created_at
            FROM berkas_serah_terima
            WHERE id_toko = $1
            ORDER BY id DESC
            LIMIT 1
            `,
            [idToko]
        );

        if ((existing.rowCount ?? 0) > 0) {
            return existing.rows[0];
        }

        const inserted = await pool.query<BerkasSerahTerimaRow>(
            `
            INSERT INTO berkas_serah_terima (id_toko)
            VALUES ($1)
            RETURNING id, id_toko, link_pdf, created_at
            `,
            [idToko]
        );

        return inserted.rows[0];
    },

    async updateBerkasSerahTerimaLink(id: number, linkPdf: string): Promise<BerkasSerahTerimaRow> {
        const updated = await pool.query<BerkasSerahTerimaRow>(
            `
            UPDATE berkas_serah_terima
            SET link_pdf = $1
            WHERE id = $2
            RETURNING id, id_toko, link_pdf, created_at
            `,
            [linkPdf, id]
        );

        return updated.rows[0];
    },

    /**
     * Temukan toko saudara yang sudah memiliki Opname Final, seluruh pekerjaan
     * selesai sudah masuk Opname, dan belum punya berkas Serah Terima.
     */
    async findSiblingTokosReadyForST(nomorUlok: string, excludeIdToko: number): Promise<{ id: number; lingkup_pekerjaan: string | null }[]> {
        const result = await pool.query(
            `
            SELECT t.id, t.lingkup_pekerjaan
            FROM toko t
            WHERE t.nomor_ulok = $1
              AND t.id != $2
              AND EXISTS (
                  SELECT 1 FROM opname_final of2
                  WHERE of2.id_toko = t.id
              )
              AND EXISTS (
                  SELECT 1
                  FROM (
                      SELECT DISTINCT ON (
                          UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                          UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                      )
                          p.kategori_pekerjaan,
                          p.jenis_pekerjaan,
                          p.status
                      FROM pengawasan p
                      LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
                      WHERE p.id_gantt = (
                          SELECT g2.id
                          FROM gantt_chart g2
                          WHERE g2.id_toko = t.id
                          ORDER BY g2.id DESC
                          LIMIT 1
                      )
                      ORDER BY
                          UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                          UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                          to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                          p.id DESC
                  ) latest_item
                  WHERE latest_item.status = 'selesai'
                    AND EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = t.id
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(latest_item.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(latest_item.jenis_pekerjaan, '')))
                    )
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM (
                      SELECT DISTINCT ON (
                          UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                          UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                      )
                          p.kategori_pekerjaan,
                          p.jenis_pekerjaan,
                          p.status
                      FROM pengawasan p
                      LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
                      WHERE p.id_gantt = (
                          SELECT g2.id
                          FROM gantt_chart g2
                          WHERE g2.id_toko = t.id
                          ORDER BY g2.id DESC
                          LIMIT 1
                      )
                      ORDER BY
                          UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                          UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                          to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                          p.id DESC
                  ) latest_item
                  WHERE latest_item.status = 'selesai'
                    AND NOT EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = t.id
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(latest_item.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(latest_item.jenis_pekerjaan, '')))
                    )
              )
              AND NOT EXISTS (
                  SELECT 1 FROM berkas_serah_terima bst
                  WHERE bst.id_toko = t.id
              )
            `,
            [nomorUlok, excludeIdToko]
        );
        return result.rows;
    },
};
