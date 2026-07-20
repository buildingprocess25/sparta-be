-- Backfill last pengawasan_gantt date for every Gantt under an ULOK that has approved
-- pertambahan SPK. Pertambahan SPK applies to all lingkup in the same nomor_ulok.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_backfill_cross_lingkup_pertambahan_gantt_end_2026_07_20 (
    id SERIAL PRIMARY KEY,
    nomor_ulok TEXT NOT NULL,
    gantt_id INT NOT NULL,
    id_toko INT NOT NULL,
    lingkup_pekerjaan TEXT,
    tanggal_pengawasan TEXT NOT NULL,
    inserted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

WITH parsed_pertambahan AS (
    SELECT
        ps.nomor_ulok,
        CASE
            WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\d{4}-\d{2}-\d{2}'
                THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
            WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
            ELSE NULL
        END AS effective_end
    FROM pertambahan_spk pt
    JOIN pengajuan_spk ps ON ps.id = pt.id_spk
    WHERE UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
),
effective_by_ulok AS (
    SELECT nomor_ulok, to_char(MAX(effective_end), 'DD/MM/YYYY') AS tanggal_pengawasan
    FROM parsed_pertambahan
    WHERE effective_end IS NOT NULL
    GROUP BY nomor_ulok
),
candidates AS (
    SELECT
        t.nomor_ulok,
        g.id AS gantt_id,
        t.id AS id_toko,
        t.lingkup_pekerjaan,
        e.tanggal_pengawasan
    FROM effective_by_ulok e
    JOIN toko t ON t.nomor_ulok = e.nomor_ulok
    JOIN gantt_chart g ON g.id_toko = t.id
    WHERE NOT EXISTS (
        SELECT 1
        FROM pengawasan_gantt pg
        WHERE pg.id_gantt = g.id
          AND pg.tanggal_pengawasan = e.tanggal_pengawasan
    )
),
inserted AS (
    INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
    SELECT gantt_id, tanggal_pengawasan
    FROM candidates
    RETURNING id_gantt, tanggal_pengawasan
)
INSERT INTO audit_backfill_cross_lingkup_pertambahan_gantt_end_2026_07_20 (
    nomor_ulok,
    gantt_id,
    id_toko,
    lingkup_pekerjaan,
    tanggal_pengawasan
)
SELECT
    c.nomor_ulok,
    c.gantt_id,
    c.id_toko,
    c.lingkup_pekerjaan,
    c.tanggal_pengawasan
FROM candidates c
JOIN inserted i
  ON i.id_gantt = c.gantt_id
 AND i.tanggal_pengawasan = c.tanggal_pengawasan;

COMMIT;

