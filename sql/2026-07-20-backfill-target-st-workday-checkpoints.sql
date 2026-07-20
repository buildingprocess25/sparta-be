-- Backfill Target ST checkpoints for existing Gantt data.
-- Rule:
--   - Target ST is the first working day after the effective SPK end date.
--   - If the next day is weekend/national holiday, move forward until a working day.
--   - Approved pertambahan SPK in one ULOK affects all scopes in that ULOK.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_backfill_target_st_workday_checkpoints_2026_07_20 (
    id SERIAL PRIMARY KEY,
    gantt_id INT NOT NULL,
    nomor_ulok TEXT,
    lingkup_pekerjaan TEXT,
    effective_spk_end DATE NOT NULL,
    target_st_date DATE NOT NULL,
    target_st_label TEXT NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

WITH national_holidays(date_value) AS (
    VALUES
        (DATE '2026-01-01'),
        (DATE '2026-01-16'),
        (DATE '2026-02-17'),
        (DATE '2026-03-19'),
        (DATE '2026-04-03'),
        (DATE '2026-05-01'),
        (DATE '2026-05-14'),
        (DATE '2026-05-27'),
        (DATE '2026-06-01'),
        (DATE '2026-06-16'),
        (DATE '2026-08-17'),
        (DATE '2026-08-25'),
        (DATE '2026-12-25')
),
approved_extension_end AS (
    SELECT
        ps_scope.nomor_ulok,
        MAX(
            CASE
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                    THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
                    THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
                ELSE NULL
            END
        ) AS extension_end
    FROM pertambahan_spk pt
    JOIN pengajuan_spk ps_scope ON ps_scope.id = pt.id_spk
    WHERE UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
    GROUP BY ps_scope.nomor_ulok
),
target_gantt AS (
    SELECT
        gc.id AS gantt_id,
        t.nomor_ulok,
        t.lingkup_pekerjaan,
        GREATEST(
            ps.waktu_selesai::date,
            COALESCE(aee.extension_end, ps.waktu_selesai::date)
        ) AS effective_spk_end
    FROM gantt_chart gc
    JOIN toko t ON t.id = gc.id_toko
    JOIN LATERAL (
        SELECT p.*
        FROM pengajuan_spk p
        WHERE p.id_toko = t.id
          AND UPPER(TRIM(COALESCE(p.status, ''))) NOT IN ('REJECTED', 'REJECT', 'CANCELLED', 'CANCEL')
        ORDER BY p.id DESC
        LIMIT 1
    ) ps ON true
    LEFT JOIN approved_extension_end aee ON aee.nomor_ulok = ps.nomor_ulok
    WHERE ps.waktu_selesai IS NOT NULL
),
candidate_days AS (
    SELECT
        tg.*,
        gs::date AS candidate_date
    FROM target_gantt tg
    CROSS JOIN LATERAL generate_series(tg.effective_spk_end + INTERVAL '1 day', tg.effective_spk_end + INTERVAL '14 days', INTERVAL '1 day') gs
),
target_st AS (
    SELECT DISTINCT ON (cd.gantt_id)
        cd.gantt_id,
        cd.nomor_ulok,
        cd.lingkup_pekerjaan,
        cd.effective_spk_end,
        cd.candidate_date AS target_st_date,
        'SPK +' || (cd.candidate_date - cd.effective_spk_end)::text || ' hari' AS target_st_label
    FROM candidate_days cd
    LEFT JOIN national_holidays nh ON nh.date_value = cd.candidate_date
    WHERE EXTRACT(DOW FROM cd.candidate_date) NOT IN (0, 6)
      AND nh.date_value IS NULL
    ORDER BY cd.gantt_id, cd.candidate_date
),
inserted AS (
    INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
    SELECT
        ts.gantt_id,
        to_char(ts.target_st_date, 'DD/MM/YYYY')
    FROM target_st ts
    WHERE NOT EXISTS (
        SELECT 1
        FROM pengawasan_gantt pg
        WHERE pg.id_gantt = ts.gantt_id
          AND pg.tanggal_pengawasan = to_char(ts.target_st_date, 'DD/MM/YYYY')
    )
    RETURNING id_gantt, tanggal_pengawasan
)
INSERT INTO audit_backfill_target_st_workday_checkpoints_2026_07_20 (
    gantt_id,
    nomor_ulok,
    lingkup_pekerjaan,
    effective_spk_end,
    target_st_date,
    target_st_label
)
SELECT
    ts.gantt_id,
    ts.nomor_ulok,
    ts.lingkup_pekerjaan,
    ts.effective_spk_end,
    ts.target_st_date,
    ts.target_st_label
FROM target_st ts
JOIN inserted i
  ON i.id_gantt = ts.gantt_id
 AND i.tanggal_pengawasan = to_char(ts.target_st_date, 'DD/MM/YYYY');

COMMIT;
