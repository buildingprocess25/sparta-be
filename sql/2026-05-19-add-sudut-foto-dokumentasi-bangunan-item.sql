-- ============================================================
-- Add sudut_foto to dokumentasi_bangunan_item
-- ============================================================

ALTER TABLE dokumentasi_bangunan_item
    ADD COLUMN IF NOT EXISTS sudut_foto VARCHAR(255);
