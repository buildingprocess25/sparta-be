-- ============================================================
-- Dokumentasi Bangunan: jenis toko regular/franchise
-- ============================================================

ALTER TABLE dokumentasi_bangunan
ADD COLUMN IF NOT EXISTS jenis_toko VARCHAR(50) NOT NULL DEFAULT 'REGULAR';

UPDATE dokumentasi_bangunan
SET jenis_toko = 'REGULAR'
WHERE jenis_toko IS NULL OR BTRIM(jenis_toko) = '';

ALTER TABLE dokumentasi_bangunan
DROP CONSTRAINT IF EXISTS chk_dokumentasi_bangunan_jenis_toko;

ALTER TABLE dokumentasi_bangunan
ADD CONSTRAINT chk_dokumentasi_bangunan_jenis_toko
CHECK (jenis_toko IN ('REGULAR', 'FRANCHISE'));

CREATE INDEX IF NOT EXISTS idx_dokumentasi_bangunan_jenis_toko
ON dokumentasi_bangunan(jenis_toko);
