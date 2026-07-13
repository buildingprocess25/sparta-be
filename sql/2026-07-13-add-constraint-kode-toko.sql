-- ============================================================
-- Migration: Add constraint untuk validasi kode_toko
-- Tanggal: 2026-07-13
-- Deskripsi: Menambahkan constraint check untuk memastikan 
--            kode_toko minimal 2 karakter alfanumerik dan 
--            tidak boleh hanya berisi karakter '-'
-- ============================================================

-- 1. Update data existing yang memiliki kode_toko invalid (optional, backup dulu!)
-- Backup data yang akan diupdate
CREATE TABLE IF NOT EXISTS backup_toko_kode_invalid_2026_07_13 AS
SELECT id, nomor_ulok, nama_toko, kode_toko, cabang
FROM toko
WHERE kode_toko IS NULL 
   OR TRIM(kode_toko) = '' 
   OR TRIM(kode_toko) = '-'
   OR LENGTH(TRIM(kode_toko)) < 2
   OR UPPER(TRIM(kode_toko)) !~ '^[A-Z0-9]{2,}$';

-- Update kode_toko invalid menjadi 'UNKNOWN' atau bisa disesuaikan
UPDATE toko
SET kode_toko = 'UNKNOWN'
WHERE kode_toko IS NULL 
   OR TRIM(kode_toko) = '' 
   OR TRIM(kode_toko) = '-'
   OR LENGTH(TRIM(kode_toko)) < 2
   OR UPPER(TRIM(kode_toko)) !~ '^[A-Z0-9]{2,}$';

-- 2. Tambahkan constraint check di tabel toko
ALTER TABLE toko
DROP CONSTRAINT IF EXISTS chk_toko_kode_toko_valid;

ALTER TABLE toko
ADD CONSTRAINT chk_toko_kode_toko_valid
CHECK (
    kode_toko IS NOT NULL
    AND LENGTH(TRIM(kode_toko)) >= 2
    AND UPPER(TRIM(kode_toko)) ~ '^[A-Z0-9]{2,}$'
);

-- 3. Cek data yang sudah diupdate
SELECT 
    'Data yang diupdate' AS info,
    COUNT(*) AS jumlah
FROM backup_toko_kode_invalid_2026_07_13;

-- 4. Verifikasi constraint sudah terpasang
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'toko'::regclass
  AND conname = 'chk_toko_kode_toko_valid';

-- 5. Test insert data invalid (harus gagal)
DO $$
BEGIN
    -- Test 1: kode_toko dengan karakter '-' saja
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
        VALUES ('TEST-001', 'Test Toko 1', '-', 'TEST', 'Test Address');
        RAISE EXCEPTION 'Test 1 GAGAL: Seharusnya constraint menolak kode_toko = "-"';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 1 BERHASIL: Constraint menolak kode_toko = "-"';
    END;

    -- Test 2: kode_toko hanya 1 karakter
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
        VALUES ('TEST-002', 'Test Toko 2', 'T', 'TEST', 'Test Address');
        RAISE EXCEPTION 'Test 2 GAGAL: Seharusnya constraint menolak kode_toko 1 karakter';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 2 BERHASIL: Constraint menolak kode_toko 1 karakter';
    END;

    -- Test 3: kode_toko dengan special character
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
        VALUES ('TEST-003', 'Test Toko 3', 'T@123', 'TEST', 'Test Address');
        RAISE EXCEPTION 'Test 3 GAGAL: Seharusnya constraint menolak kode_toko dengan special character';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 3 BERHASIL: Constraint menolak kode_toko dengan special character';
    END;

    -- Test 4: kode_toko valid (harus berhasil)
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat, lingkup_pekerjaan)
        VALUES ('TEST-004', 'Test Toko 4', 'T123', 'TEST', 'Test Address', 'TEST');
        DELETE FROM toko WHERE nomor_ulok = 'TEST-004';
        RAISE NOTICE 'Test 4 BERHASIL: Constraint menerima kode_toko valid "T123"';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Test 4 GAGAL: Seharusnya constraint menerima kode_toko valid';
    END;
END $$;

COMMENT ON CONSTRAINT chk_toko_kode_toko_valid ON toko IS 
    'Memastikan kode_toko minimal 2 karakter alfanumerik, tidak boleh NULL atau karakter khusus';
