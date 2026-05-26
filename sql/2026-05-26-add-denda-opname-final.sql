ALTER TABLE opname_final
    ADD COLUMN IF NOT EXISTS hari_denda INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nilai_denda NUMERIC(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tanggal_akhir_spk_denda DATE,
    ADD COLUMN IF NOT EXISTS tanggal_serah_terima_denda DATE;

WITH penalty_source AS (
    SELECT
        ofn.id AS opname_final_id,
        spk.tanggal_akhir_spk,
        st.tanggal_serah_terima
    FROM opname_final ofn
    JOIN toko target_toko ON target_toko.id = ofn.id_toko
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(peer_toko.id ORDER BY peer_toko.id) AS toko_ids
        FROM toko peer_toko
        WHERE peer_toko.nomor_ulok = target_toko.nomor_ulok
          AND (
              target_toko.cabang IS NULL
              OR peer_toko.cabang IS NULL
              OR UPPER(peer_toko.cabang) = UPPER(target_toko.cabang)
          )
    ) scope ON TRUE
    LEFT JOIN LATERAL (
        SELECT MAX(COALESCE(ext.tanggal_perpanjangan, parsed_spk.waktu_selesai)) AS tanggal_akhir_spk
        FROM pengajuan_spk ps
        CROSS JOIN LATERAL (
            SELECT CASE
                WHEN NULLIF(ps.waktu_selesai::text, '') ~ '^\d{4}-\d{2}-\d{2}' THEN ps.waktu_selesai::date
                WHEN NULLIF(ps.waktu_selesai::text, '') ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(ps.waktu_selesai::text, 'DD/MM/YYYY')
                ELSE NULL
            END AS waktu_selesai
        ) parsed_spk
        LEFT JOIN LATERAL (
            SELECT MAX(CASE
                WHEN NULLIF(pt.tanggal_spk_akhir_setelah_perpanjangan::text, '') ~ '^\d{4}-\d{2}-\d{2}' THEN pt.tanggal_spk_akhir_setelah_perpanjangan::date
                WHEN NULLIF(pt.tanggal_spk_akhir_setelah_perpanjangan::text, '') ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(pt.tanggal_spk_akhir_setelah_perpanjangan::text, 'DD/MM/YYYY')
                ELSE NULL
            END) AS tanggal_perpanjangan
            FROM pertambahan_spk pt
            WHERE pt.id_spk = ps.id
              AND UPPER(COALESCE(pt.status_persetujuan, '')) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
        ) ext ON TRUE
        WHERE (
              ps.id_toko = ANY(COALESCE(scope.toko_ids, ARRAY[ofn.id_toko]))
              OR (
                  target_toko.nomor_ulok IS NOT NULL
                  AND ps.nomor_ulok = target_toko.nomor_ulok
              )
          )
          AND UPPER(COALESCE(ps.status, '')) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
    ) spk ON TRUE
    LEFT JOIN LATERAL (
        SELECT bst.created_at::date AS tanggal_serah_terima
        FROM berkas_serah_terima bst
        WHERE bst.id_toko = ANY(COALESCE(scope.toko_ids, ARRAY[ofn.id_toko]))
        ORDER BY bst.created_at DESC, bst.id DESC
        LIMIT 1
    ) st ON TRUE
),
penalty_dates AS (
    SELECT
        opname_final_id,
        tanggal_akhir_spk,
        tanggal_serah_terima,
        CASE
            WHEN tanggal_akhir_spk IS NULL THEN NULL
            WHEN EXTRACT(ISODOW FROM tanggal_akhir_spk) = 5 THEN tanggal_akhir_spk + INTERVAL '3 days'
            WHEN EXTRACT(ISODOW FROM tanggal_akhir_spk) = 6 THEN tanggal_akhir_spk + INTERVAL '2 days'
            ELSE tanggal_akhir_spk + INTERVAL '1 day'
        END::date AS tanggal_bebas_denda
    FROM penalty_source
),
penalty AS (
    SELECT
        pd.opname_final_id,
        pd.tanggal_akhir_spk,
        pd.tanggal_serah_terima,
        CASE
            WHEN pd.tanggal_akhir_spk IS NULL OR pd.tanggal_serah_terima IS NULL OR pd.tanggal_serah_terima <= pd.tanggal_bebas_denda THEN 0
            ELSE (
                SELECT COUNT(*)::int
                FROM generate_series(pd.tanggal_bebas_denda + INTERVAL '1 day', pd.tanggal_serah_terima, INTERVAL '1 day') AS d(day_value)
                WHERE EXTRACT(ISODOW FROM d.day_value) < 6
            )
        END AS hari_denda
    FROM penalty_dates pd
)
UPDATE opname_final ofn
SET hari_denda = penalty.hari_denda,
    nilai_denda = LEAST(
        (LEAST(penalty.hari_denda, 5) * 1000000)
        + (GREATEST(LEAST(penalty.hari_denda - 5, 10), 0) * 500000),
        10000000
    ),
    tanggal_akhir_spk_denda = penalty.tanggal_akhir_spk,
    tanggal_serah_terima_denda = penalty.tanggal_serah_terima
FROM penalty
WHERE ofn.id = penalty.opname_final_id;
