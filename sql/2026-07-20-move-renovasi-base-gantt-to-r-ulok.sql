-- Move legacy non-R Gantt rows to their matching Renovasi (-R) toko scope.
-- Safe condition:
-- - base toko has Gantt
-- - matching -R toko exists with the same lingkup_pekerjaan
-- - matching -R toko already has SPK
-- - matching -R toko does not yet have Gantt

BEGIN;

CREATE TABLE IF NOT EXISTS audit_move_renovasi_base_gantt_to_r_ulok_2026_07_20 (
    id SERIAL PRIMARY KEY,
    gantt_id INT NOT NULL,
    old_id_toko INT NOT NULL,
    old_nomor_ulok TEXT,
    old_lingkup_pekerjaan TEXT,
    new_id_toko INT NOT NULL,
    new_nomor_ulok TEXT,
    new_lingkup_pekerjaan TEXT,
    moved_at TIMESTAMP NOT NULL DEFAULT NOW()
);

WITH candidates AS (
    SELECT
        gc.id AS gantt_id,
        t_base.id AS old_id_toko,
        t_base.nomor_ulok AS old_nomor_ulok,
        t_base.lingkup_pekerjaan AS old_lingkup_pekerjaan,
        t_r.id AS new_id_toko,
        t_r.nomor_ulok AS new_nomor_ulok,
        t_r.lingkup_pekerjaan AS new_lingkup_pekerjaan
    FROM gantt_chart gc
    JOIN toko t_base ON t_base.id = gc.id_toko
    JOIN toko t_r
      ON t_r.nomor_ulok = t_base.nomor_ulok || '-R'
     AND UPPER(TRIM(t_r.lingkup_pekerjaan)) = UPPER(TRIM(t_base.lingkup_pekerjaan))
    WHERE t_base.nomor_ulok !~* '-R$'
      AND EXISTS (
          SELECT 1
          FROM pengajuan_spk ps
          WHERE ps.id_toko = t_r.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM gantt_chart gc_target
          WHERE gc_target.id_toko = t_r.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM audit_move_renovasi_base_gantt_to_r_ulok_2026_07_20 audit
          WHERE audit.gantt_id = gc.id
      )
),
audit_insert AS (
    INSERT INTO audit_move_renovasi_base_gantt_to_r_ulok_2026_07_20 (
        gantt_id,
        old_id_toko,
        old_nomor_ulok,
        old_lingkup_pekerjaan,
        new_id_toko,
        new_nomor_ulok,
        new_lingkup_pekerjaan
    )
    SELECT
        gantt_id,
        old_id_toko,
        old_nomor_ulok,
        old_lingkup_pekerjaan,
        new_id_toko,
        new_nomor_ulok,
        new_lingkup_pekerjaan
    FROM candidates
    RETURNING gantt_id, new_id_toko
)
UPDATE gantt_chart gc
SET id_toko = audit_insert.new_id_toko
FROM audit_insert
WHERE gc.id = audit_insert.gantt_id;

COMMIT;

