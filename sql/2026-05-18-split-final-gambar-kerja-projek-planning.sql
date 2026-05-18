-- ============================================================
-- Migration: 2026-05-18-split-final-gambar-kerja-projek-planning.sql
-- Description: Pisahkan Gambar Kerja Final menjadi Sipil dan ME.
-- Aman dijalankan berulang kali di DBeaver.
-- ============================================================

ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS link_gambar_kerja_final_sipil TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS link_gambar_kerja_final_me TEXT DEFAULT NULL;

UPDATE projek_planning
SET link_gambar_kerja_final_sipil = link_gambar_kerja_final
WHERE link_gambar_kerja_final_sipil IS NULL
  AND link_gambar_kerja_final IS NOT NULL;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'projek_planning'
  AND column_name IN (
      'link_gambar_kerja_final',
      'link_gambar_kerja_final_sipil',
      'link_gambar_kerja_final_me'
  )
ORDER BY column_name;
