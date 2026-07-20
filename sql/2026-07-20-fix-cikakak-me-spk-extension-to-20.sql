-- CIKAKAK Cianjur / 2JZ1-1708-0005-R:
-- Align ME original SPK end date with SIPIL (15/07/2026), so +5 days ends on 20/07/2026.
-- Also replace empty synced Gantt checkpoint 19/07/2026 with 20/07/2026 for both lingkup.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_fix_cikakak_me_spk_extension_to_20_2026_07_20 (
    id SERIAL PRIMARY KEY,
    entity TEXT NOT NULL,
    entity_id INT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO audit_fix_cikakak_me_spk_extension_to_20_2026_07_20 (entity, entity_id, field_name, old_value, new_value)
SELECT 'pengajuan_spk', ps.id, 'waktu_selesai', ps.waktu_selesai::text, '2026-07-15 00:00:00+00'
FROM pengajuan_spk ps
WHERE ps.id = 288
  AND ps.nomor_ulok = '2JZ1-1708-0005-R'
  AND UPPER(TRIM(ps.lingkup_pekerjaan)) = 'ME'
  AND ps.waktu_selesai::date <> DATE '2026-07-15';

INSERT INTO audit_fix_cikakak_me_spk_extension_to_20_2026_07_20 (entity, entity_id, field_name, old_value, new_value)
SELECT 'pengajuan_spk', ps.id, 'durasi', ps.durasi::text, '31'
FROM pengajuan_spk ps
WHERE ps.id = 288
  AND ps.nomor_ulok = '2JZ1-1708-0005-R'
  AND UPPER(TRIM(ps.lingkup_pekerjaan)) = 'ME'
  AND ps.durasi <> 31;

UPDATE pengajuan_spk
SET waktu_selesai = TIMESTAMPTZ '2026-07-15 00:00:00+00',
    durasi = 31
WHERE id = 288
  AND nomor_ulok = '2JZ1-1708-0005-R'
  AND UPPER(TRIM(lingkup_pekerjaan)) = 'ME';

INSERT INTO audit_fix_cikakak_me_spk_extension_to_20_2026_07_20 (entity, entity_id, field_name, old_value, new_value)
SELECT 'pertambahan_spk', pt.id, 'tanggal_spk_akhir', pt.tanggal_spk_akhir, '2026-07-15'
FROM pertambahan_spk pt
WHERE pt.id = 294
  AND pt.id_spk = 288
  AND pt.tanggal_spk_akhir <> '2026-07-15';

INSERT INTO audit_fix_cikakak_me_spk_extension_to_20_2026_07_20 (entity, entity_id, field_name, old_value, new_value)
SELECT 'pertambahan_spk', pt.id, 'tanggal_spk_akhir_setelah_perpanjangan', pt.tanggal_spk_akhir_setelah_perpanjangan, '2026-07-20'
FROM pertambahan_spk pt
WHERE pt.id = 294
  AND pt.id_spk = 288
  AND pt.tanggal_spk_akhir_setelah_perpanjangan <> '2026-07-20';

UPDATE pertambahan_spk
SET tanggal_spk_akhir = '2026-07-15',
    tanggal_spk_akhir_setelah_perpanjangan = '2026-07-20'
WHERE id = 294
  AND id_spk = 288;

WITH deleted_old_checkpoint AS (
    DELETE FROM pengawasan_gantt pg
    USING gantt_chart gc, toko t
    WHERE gc.id = pg.id_gantt
      AND t.id = gc.id_toko
      AND t.nomor_ulok = '2JZ1-1708-0005-R'
      AND pg.tanggal_pengawasan = '19/07/2026'
      AND NOT EXISTS (SELECT 1 FROM pengawasan p WHERE p.id_pengawasan_gantt = pg.id)
      AND NOT EXISTS (SELECT 1 FROM berkas_pengawasan bp WHERE bp.id_pengawasan_gantt = pg.id)
    RETURNING pg.id, pg.id_gantt, t.lingkup_pekerjaan
)
INSERT INTO audit_fix_cikakak_me_spk_extension_to_20_2026_07_20 (entity, entity_id, field_name, old_value, new_value)
SELECT 'pengawasan_gantt', id, 'tanggal_pengawasan', '19/07/2026', 'deleted_before_20/07/2026_insert'
FROM deleted_old_checkpoint;

WITH target_gantt AS (
    SELECT gc.id AS gantt_id
    FROM gantt_chart gc
    JOIN toko t ON t.id = gc.id_toko
    WHERE t.nomor_ulok = '2JZ1-1708-0005-R'
      AND UPPER(TRIM(t.lingkup_pekerjaan)) IN ('SIPIL', 'ME')
),
inserted AS (
    INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
    SELECT tg.gantt_id, '20/07/2026'
    FROM target_gantt tg
    WHERE NOT EXISTS (
        SELECT 1
        FROM pengawasan_gantt pg
        WHERE pg.id_gantt = tg.gantt_id
          AND pg.tanggal_pengawasan = '20/07/2026'
    )
    RETURNING id, id_gantt
)
INSERT INTO audit_fix_cikakak_me_spk_extension_to_20_2026_07_20 (entity, entity_id, field_name, old_value, new_value)
SELECT 'pengawasan_gantt', id, 'tanggal_pengawasan', NULL, '20/07/2026'
FROM inserted;

COMMIT;

