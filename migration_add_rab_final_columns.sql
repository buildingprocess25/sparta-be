-- ============================================================
-- MIGRATION: Tambah kolom baru untuk fitur baru form FPD
-- Jalankan di database PostgreSQL (Render atau local)
-- ============================================================

-- 1. Kolom RAB Final (dari sesi sebelumnya)
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS link_rab_sipil VARCHAR(2048) NULL;
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS link_rab_me VARCHAR(2048) NULL;
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS link_gambar_kerja_final VARCHAR(2048) NULL;

-- 2. Kolom baru untuk form koordinator
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS is_head_to_head BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS is_seating_area BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS is_dark_store BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS beanspot_tipe VARCHAR(100) NULL;

-- Verifikasi semua kolom baru sudah ada
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projek_planning'
  AND column_name IN (
    'link_rab_sipil', 'link_rab_me', 'link_gambar_kerja_final',
    'is_head_to_head', 'is_seating_area', 'is_dark_store', 'beanspot_tipe'
  )
ORDER BY column_name;
