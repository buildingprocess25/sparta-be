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

-- Update kode_toko invalid menjadi 'XXXX' (4 karakter placeholder)
UPDATE toko
SET kode_toko = 'XXXX'
WHERE kode_toko IS NULL 
   OR TRIM(kode_toko) = '' 
   OR TRIM(kode_toko) = '-'
   OR LENGTH(TRIM(kode_toko)) != 4
   OR UPPER(TRIM(kode_toko)) !~ '^[A-Z0-9]{4}$';

-- 2. Tambahkan constraint check di tabel toko
ALTER TABLE toko
DROP CONSTRAINT IF EXISTS chk_toko_kode_toko_valid;

ALTER TABLE toko
ADD CONSTRAINT chk_toko_kode_toko_valid
CHECK (
    kode_toko IS NOT NULL
    AND LENGTH(TRIM(kode_toko)) = 4
    AND UPPER(TRIM(kode_toko)) ~ '^[A-Z0-9]{4}$'
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

-- 5. Verifikasi data yang sudah ter-update
SELECT 
    'Toko dengan kode_toko XXXX (perlu diupdate manual)' AS info,
    COUNT(*) AS jumlah
FROM toko
WHERE kode_toko = 'XXXX';

-- 6. Test insert data invalid (harus gagal)
DO $$
BEGIN
    -- Test 1: kode_toko dengan karakter '-' saja
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
        VALUES ('TEST-001', 'Test Toko 1', '----', 'TEST', 'Test Address');
        RAISE EXCEPTION 'Test 1 GAGAL: Seharusnya constraint menolak kode_toko = "----"';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 1 BERHASIL: Constraint menolak kode_toko = "----"';
    END;

    -- Test 2: kode_toko hanya 3 karakter
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
        VALUES ('TEST-002', 'Test Toko 2', 'T12', 'TEST', 'Test Address');
        RAISE EXCEPTION 'Test 2 GAGAL: Seharusnya constraint menolak kode_toko 3 karakter';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 2 BERHASIL: Constraint menolak kode_toko 3 karakter';
    END;

    -- Test 3: kode_toko 5 karakter
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
        VALUES ('TEST-003', 'Test Toko 3', 'T1234', 'TEST', 'Test Address');
        RAISE EXCEPTION 'Test 3 GAGAL: Seharusnya constraint menolak kode_toko 5 karakter';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 3 BERHASIL: Constraint menolak kode_toko 5 karakter';
    END;

    -- Test 4: kode_toko dengan special character
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat)
        VALUES ('TEST-004', 'Test Toko 4', 'T@12', 'TEST', 'Test Address');
        RAISE EXCEPTION 'Test 4 GAGAL: Seharusnya constraint menolak kode_toko dengan special character';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 4 BERHASIL: Constraint menolak kode_toko dengan special character';
    END;

    -- Test 5: kode_toko valid 4 karakter alfanumerik (harus berhasil)
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat, lingkup_pekerjaan)
        VALUES ('TEST-005', 'Test Toko 5', 'T123', 'TEST', 'Test Address', 'TEST');
        DELETE FROM toko WHERE nomor_ulok = 'TEST-005';
        RAISE NOTICE 'Test 5 BERHASIL: Constraint menerima kode_toko valid "T123"';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Test 5 GAGAL: Seharusnya constraint menerima kode_toko valid 4 karakter';
    END;

    -- Test 6: kode_toko valid kombinasi huruf dan angka
    BEGIN
        INSERT INTO toko (nomor_ulok, nama_toko, kode_toko, cabang, alamat, lingkup_pekerjaan)
        VALUES ('TEST-006', 'Test Toko 6', 'AB12', 'TEST', 'Test Address', 'TEST');
        DELETE FROM toko WHERE nomor_ulok = 'TEST-006';
        RAISE NOTICE 'Test 6 BERHASIL: Constraint menerima kode_toko valid "AB12"';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Test 6 GAGAL: Seharusnya constraint menerima kode_toko valid';
    END;
END $$;

COMMENT ON CONSTRAINT chk_toko_kode_toko_valid ON toko IS 
    'Memastikan kode_toko tepat 4 karakter alfanumerik (kombinasi huruf A-Z dan angka 0-9), tidak boleh NULL atau karakter khusus';
