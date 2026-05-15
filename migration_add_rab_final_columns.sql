-- Migration: Tambah kolom RAB Sipil Final, RAB ME Final, Gambar Kerja Final
-- Jalankan di database Render (PostgreSQL)

ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS link_rab_sipil VARCHAR(2048) NULL;
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS link_rab_me VARCHAR(2048) NULL;
ALTER TABLE projek_planning ADD COLUMN IF NOT EXISTS link_gambar_kerja_final VARCHAR(2048) NULL;

-- Verifikasi
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projek_planning' 
  AND column_name IN ('link_rab_sipil', 'link_rab_me', 'link_gambar_kerja_final');
