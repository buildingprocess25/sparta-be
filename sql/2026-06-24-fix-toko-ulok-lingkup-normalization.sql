-- Migration: Fix Normalization untuk Nomor ULOK dan Lingkup Pekerjaan
-- Tanggal: 2026-06-24
-- Tujuan: Mengatasi case-sensitivity dan inconsistency pada nomor_ulok dan lingkup_pekerjaan
--         yang menyebabkan false duplicate detection pada RAB submission

-- ===========================================================================
-- STEP 1: Normalize semua nomor_ulok ke UPPERCASE
-- ===========================================================================
UPDATE toko
SET nomor_ulok = UPPER(TRIM(nomor_ulok))
WHERE nomor_ulok IS NOT NULL
  AND nomor_ulok != UPPER(TRIM(nomor_ulok));

-- ===========================================================================
-- STEP 2: Normalize lingkup_pekerjaan ke UPPERCASE (SIPIL/ME saja)
-- ===========================================================================
UPDATE toko
SET lingkup_pekerjaan = UPPER(TRIM(lingkup_pekerjaan))
WHERE lingkup_pekerjaan IS NOT NULL
  AND lingkup_pekerjaan != UPPER(TRIM(lingkup_pekerjaan))
  AND UPPER(TRIM(lingkup_pekerjaan)) IN ('SIPIL', 'ME');

-- ===========================================================================
-- STEP 3: Set lingkup_pekerjaan ke NULL jika kosong string
-- ===========================================================================
UPDATE toko
SET lingkup_pekerjaan = NULL
WHERE lingkup_pekerjaan IS NOT NULL
  AND TRIM(lingkup_pekerjaan) = '';

-- ===========================================================================
-- STEP 4: Identifikasi dan report duplicate toko (untuk manual review)
-- ===========================================================================
-- Query berikut akan menampilkan toko yang duplicate berdasarkan nomor_ulok + lingkup_pekerjaan
-- Ini perlu di-review manual untuk memutuskan mana yang akan di-keep
SELECT 
    nomor_ulok,
    COALESCE(lingkup_pekerjaan, '(NULL)') AS lingkup_pekerjaan,
    COUNT(*) AS jumlah_duplicate,
    STRING_AGG(id::text, ', ' ORDER BY id) AS list_id_toko,
    STRING_AGG(nama_toko, ' | ' ORDER BY id) AS list_nama_toko
FROM toko
GROUP BY nomor_ulok, lingkup_pekerjaan
HAVING COUNT(*) > 1
ORDER BY nomor_ulok, lingkup_pekerjaan;

-- ===========================================================================
-- STEP 5: Drop existing constraint jika ada, buat ulang dengan normalization
-- ===========================================================================
-- Hapus constraint lama (jika ada)
ALTER TABLE toko DROP CONSTRAINT IF EXISTS toko_nomor_ulok_lingkup_pekerjaan_key;

-- Buat functional unique index yang normalize case-sensitivity
-- Index ini akan mencegah duplicate dengan ULOK yang sama (regardless of case)
-- dan lingkup yang sama (SIPIL/ME atau NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_toko_ulok_lingkup_normalized 
ON toko (
    UPPER(TRIM(nomor_ulok)), 
    COALESCE(UPPER(TRIM(lingkup_pekerjaan)), '')
);

-- ===========================================================================
-- VERIFICATION QUERIES (untuk di-run manual setelah migration)
-- ===========================================================================

-- Cek berapa banyak toko yang punya lingkup NULL vs SIPIL vs ME
-- SELECT 
--     COALESCE(lingkup_pekerjaan, '(NULL)') AS lingkup,
--     COUNT(*) AS jumlah
-- FROM toko
-- GROUP BY lingkup_pekerjaan
-- ORDER BY lingkup_pekerjaan;

-- Cek apakah masih ada case yang tidak normalized
-- SELECT COUNT(*)
-- FROM toko
-- WHERE nomor_ulok != UPPER(TRIM(nomor_ulok))
--    OR (lingkup_pekerjaan IS NOT NULL 
--        AND lingkup_pekerjaan != UPPER(TRIM(lingkup_pekerjaan))
--        AND UPPER(TRIM(lingkup_pekerjaan)) IN ('SIPIL', 'ME'));
