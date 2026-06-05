-- ============================================================
-- Migration: 2026-06-05-unique-rab-revision-item.sql
-- Description:
--   Cegah item RAB yang sama dipilih lebih dari sekali dalam daftar revisi
--   untuk satu RAB. Partial index tetap mengizinkan id_rab_item NULL jika
--   data legacy pernah tersimpan tanpa target item.
-- ============================================================

DELETE FROM rab_revisi_item keepable
USING rab_revisi_item duplicate
WHERE keepable.id > duplicate.id
  AND keepable.id_rab = duplicate.id_rab
  AND keepable.id_rab_item = duplicate.id_rab_item
  AND keepable.id_rab_item IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rab_revisi_item_rab_item
ON rab_revisi_item (id_rab, id_rab_item)
WHERE id_rab_item IS NOT NULL;
