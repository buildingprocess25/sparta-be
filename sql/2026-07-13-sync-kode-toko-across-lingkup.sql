-- ============================================================
-- Migration: Sinkronisasi kode_toko antar lingkup (SIPIL ↔ ME)
-- Date: 2026-07-13
-- Issue: ULOK yang sama memiliki kode_toko berbeda antar lingkup
-- Example: SIPIL kosong tapi ME ada kode, atau sebaliknya
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: INVESTIGASI - Tampilkan masalah yang ada
-- ============================================================

-- 1.1 ULOK dengan kode_toko berbeda atau salah satu kosong
SELECT 
    '1.1 ULOK dengan masalah kode_toko' AS step;

WITH ulok_comparison AS (
    SELECT 
        nomor_ulok,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) AS kode_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) AS kode_me,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN id END) AS id_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN id END) AS id_me,
        MAX(nama_toko) AS nama_toko,
        MAX(cabang) AS cabang
    FROM toko
    WHERE nomor_ulok IN (
        SELECT nomor_ulok 
        FROM toko 
        GROUP BY nomor_ulok 
        HAVING COUNT(*) > 1
    )
    GROUP BY nomor_ulok
)
SELECT 
    nomor_ulok,
    kode_sipil,
    kode_me,
    CASE 
        WHEN (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
             AND (kode_me IS NOT NULL AND kode_me != '' AND kode_me != '-' AND kode_me != '----')
        THEN '⚠️ SIPIL KOSONG, ME ADA'
        WHEN (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
             AND (kode_sipil IS NOT NULL AND kode_sipil != '' AND kode_sipil != '-' AND kode_sipil != '----')
        THEN '⚠️ ME KOSONG, SIPIL ADA'
        WHEN (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
             AND (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
        THEN '❌ KEDUANYA KOSONG'
        WHEN kode_sipil != kode_me
        THEN '❌ BERBEDA'
        ELSE '✅ SAMA'
    END AS status,
    nama_toko,
    cabang
FROM ulok_comparison
WHERE 
    (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
    OR (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
    OR (kode_sipil != kode_me)
ORDER BY 
    CASE 
        WHEN (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-') 
             AND (kode_me IS NULL OR kode_me = '' OR kode_me = '-')
        THEN 1
        WHEN kode_sipil != kode_me THEN 2
        ELSE 3
    END,
    nomor_ulok
LIMIT 50;

-- 1.2 Statistik masalah
SELECT 
    '1.2 Statistik masalah' AS step;

WITH ulok_stats AS (
    SELECT 
        nomor_ulok,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) AS kode_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) AS kode_me
    FROM toko
    WHERE nomor_ulok IN (
        SELECT nomor_ulok 
        FROM toko 
        GROUP BY nomor_ulok 
        HAVING COUNT(*) > 1
    )
    GROUP BY nomor_ulok
)
SELECT 
    'Total ULOK dengan multiple lingkup' AS kategori,
    COUNT(*) AS jumlah
FROM ulok_stats
UNION ALL
SELECT 
    'SIPIL kosong, ME ada kode',
    COUNT(*)
FROM ulok_stats
WHERE (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
  AND (kode_me IS NOT NULL AND kode_me != '' AND kode_me != '-' AND kode_me != '----')
UNION ALL
SELECT 
    'ME kosong, SIPIL ada kode',
    COUNT(*)
FROM ulok_stats
WHERE (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
  AND (kode_sipil IS NOT NULL AND kode_sipil != '' AND kode_sipil != '-' AND kode_sipil != '----')
UNION ALL
SELECT 
    'Keduanya kosong',
    COUNT(*)
FROM ulok_stats
WHERE (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
  AND (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
UNION ALL
SELECT 
    'Keduanya ada tapi berbeda',
    COUNT(*)
FROM ulok_stats
WHERE (kode_sipil IS NOT NULL AND kode_sipil != '' AND kode_sipil != '-' AND kode_sipil != '----')
  AND (kode_me IS NOT NULL AND kode_me != '' AND kode_me != '-' AND kode_me != '----')
  AND kode_sipil != kode_me
UNION ALL
SELECT 
    'TOTAL PERLU MIGRASI',
    COUNT(*)
FROM ulok_stats
WHERE (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
   OR (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
   OR (kode_sipil != kode_me AND kode_sipil IS NOT NULL AND kode_me IS NOT NULL);

-- ============================================================
-- STEP 2: BACKUP DATA (Sangat disarankan!)
-- ============================================================

CREATE TABLE IF NOT EXISTS backup_toko_kode_sync_2026_07_13 AS
SELECT 
    t.*,
    now() AS backup_timestamp
FROM toko t
WHERE nomor_ulok IN (
    SELECT nomor_ulok 
    FROM toko 
    GROUP BY nomor_ulok 
    HAVING COUNT(*) > 1
);

SELECT 
    'Backup created: backup_toko_kode_sync_2026_07_13' AS info,
    COUNT(*) AS records_backed_up
FROM backup_toko_kode_sync_2026_07_13;

-- ============================================================
-- STEP 3: MIGRASI - Sinkronisasi kode_toko
-- ============================================================

-- 3.1 CASE 1: SIPIL kosong, ME ada → Copy ME ke SIPIL
SELECT 
    '3.1 Preview: Copy kode_toko dari ME ke SIPIL' AS step;

WITH updates_preview AS (
    SELECT 
        t_sipil.id AS id_sipil,
        t_sipil.nomor_ulok,
        t_sipil.kode_toko AS kode_sipil_lama,
        t_me.kode_toko AS kode_me_akan_dicopy,
        t_sipil.nama_toko
    FROM toko t_sipil
    JOIN toko t_me ON t_me.nomor_ulok = t_sipil.nomor_ulok AND t_me.lingkup_pekerjaan = 'ME'
    WHERE t_sipil.lingkup_pekerjaan = 'SIPIL'
      AND (t_sipil.kode_toko IS NULL OR t_sipil.kode_toko = '' OR t_sipil.kode_toko = '-' OR t_sipil.kode_toko = '----')
      AND (t_me.kode_toko IS NOT NULL AND t_me.kode_toko != '' AND t_me.kode_toko != '-' AND t_me.kode_toko != '----')
)
SELECT * FROM updates_preview LIMIT 20;

UPDATE toko t_sipil
SET 
    kode_toko = t_me.kode_toko,
    updated_at = now()
FROM toko t_me
WHERE t_me.nomor_ulok = t_sipil.nomor_ulok 
  AND t_me.lingkup_pekerjaan = 'ME'
  AND t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND (t_sipil.kode_toko IS NULL OR t_sipil.kode_toko = '' OR t_sipil.kode_toko = '-' OR t_sipil.kode_toko = '----')
  AND (t_me.kode_toko IS NOT NULL AND t_me.kode_toko != '' AND t_me.kode_toko != '-' AND t_me.kode_toko != '----');

SELECT 
    'CASE 1 completed: Copied kode_toko from ME to SIPIL' AS result,
    COUNT(*) AS rows_updated
FROM toko t_sipil
JOIN backup_toko_kode_sync_2026_07_13 b ON b.id = t_sipil.id
WHERE t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND (b.kode_toko IS NULL OR b.kode_toko = '' OR b.kode_toko = '-' OR b.kode_toko = '----')
  AND (t_sipil.kode_toko IS NOT NULL AND t_sipil.kode_toko != '' AND t_sipil.kode_toko != '-' AND t_sipil.kode_toko != '----');

-- 3.2 CASE 2: ME kosong, SIPIL ada → Copy SIPIL ke ME
SELECT 
    '3.2 Preview: Copy kode_toko dari SIPIL ke ME' AS step;

WITH updates_preview AS (
    SELECT 
        t_me.id AS id_me,
        t_me.nomor_ulok,
        t_me.kode_toko AS kode_me_lama,
        t_sipil.kode_toko AS kode_sipil_akan_dicopy,
        t_me.nama_toko
    FROM toko t_me
    JOIN toko t_sipil ON t_sipil.nomor_ulok = t_me.nomor_ulok AND t_sipil.lingkup_pekerjaan = 'SIPIL'
    WHERE t_me.lingkup_pekerjaan = 'ME'
      AND (t_me.kode_toko IS NULL OR t_me.kode_toko = '' OR t_me.kode_toko = '-' OR t_me.kode_toko = '----')
      AND (t_sipil.kode_toko IS NOT NULL AND t_sipil.kode_toko != '' AND t_sipil.kode_toko != '-' AND t_sipil.kode_toko != '----')
)
SELECT * FROM updates_preview LIMIT 20;

UPDATE toko t_me
SET 
    kode_toko = t_sipil.kode_toko,
    updated_at = now()
FROM toko t_sipil
WHERE t_sipil.nomor_ulok = t_me.nomor_ulok 
  AND t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND t_me.lingkup_pekerjaan = 'ME'
  AND (t_me.kode_toko IS NULL OR t_me.kode_toko = '' OR t_me.kode_toko = '-' OR t_me.kode_toko = '----')
  AND (t_sipil.kode_toko IS NOT NULL AND t_sipil.kode_toko != '' AND t_sipil.kode_toko != '-' AND t_sipil.kode_toko != '----');

SELECT 
    'CASE 2 completed: Copied kode_toko from SIPIL to ME' AS result,
    COUNT(*) AS rows_updated
FROM toko t_me
JOIN backup_toko_kode_sync_2026_07_13 b ON b.id = t_me.id
WHERE t_me.lingkup_pekerjaan = 'ME'
  AND (b.kode_toko IS NULL OR b.kode_toko = '' OR b.kode_toko = '-' OR b.kode_toko = '----')
  AND (t_me.kode_toko IS NOT NULL AND t_me.kode_toko != '' AND t_me.kode_toko != '-' AND t_me.kode_toko != '----');

-- 3.3 CASE 3: Keduanya ada tapi berbeda → Pilih yang valid (4 karakter alfanumerik)
-- 3.3.0 SPECIAL FIX: Manual resolution untuk konflik yang sudah dikonfirmasi
SELECT 
    '3.3.0 Special fix: Manual resolution untuk konflik 1YZ1-2604-0001' AS step;

-- Fix SIPIL: 1YCI → 1YC1 (typo huruf I jadi angka 1)
UPDATE toko
SET 
    kode_toko = '1YC1',
    updated_at = now()
WHERE nomor_ulok = '1YZ1-2604-0001'
  AND lingkup_pekerjaan = 'SIPIL'
  AND kode_toko = '1YCI';

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM toko 
            WHERE nomor_ulok = '1YZ1-2604-0001' 
              AND lingkup_pekerjaan = 'SIPIL' 
              AND kode_toko = '1YC1'
        )
        THEN '✅ Fixed: 1YZ1-2604-0001 SIPIL 1YCI → 1YC1'
        ELSE '⚠️ Not found or already fixed'
    END AS result;

SELECT 
    '3.3 Preview: ULOK dengan kode berbeda (perlu review manual)' AS step;

WITH conflicting_ulok AS (
    SELECT 
        nomor_ulok,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) AS kode_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) AS kode_me,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN id END) AS id_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN id END) AS id_me,
        MAX(nama_toko) AS nama_toko,
        MAX(cabang) AS cabang
    FROM toko
    WHERE nomor_ulok IN (
        SELECT nomor_ulok 
        FROM toko 
        GROUP BY nomor_ulok 
        HAVING COUNT(*) > 1
    )
    GROUP BY nomor_ulok
    HAVING 
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) IS NOT NULL
        AND MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) != ''
        AND MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) != '-'
        AND MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) != '----'
        AND MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) IS NOT NULL
        AND MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) != ''
        AND MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) != '-'
        AND MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) != '----'
        AND MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) != MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END)
)
SELECT 
    nomor_ulok,
    kode_sipil,
    kode_me,
    CASE 
        WHEN LENGTH(kode_sipil) = 4 AND kode_sipil ~ '^[A-Z0-9]{4}$' THEN '✅ SIPIL Valid'
        ELSE '❌ SIPIL Invalid'
    END AS validitas_sipil,
    CASE 
        WHEN LENGTH(kode_me) = 4 AND kode_me ~ '^[A-Z0-9]{4}$' THEN '✅ ME Valid'
        ELSE '❌ ME Invalid'
    END AS validitas_me,
    CASE 
        WHEN LENGTH(kode_sipil) = 4 AND kode_sipil ~ '^[A-Z0-9]{4}$' 
             AND (LENGTH(kode_me) != 4 OR kode_me !~ '^[A-Z0-9]{4}$')
        THEN 'Gunakan SIPIL: ' || kode_sipil
        WHEN LENGTH(kode_me) = 4 AND kode_me ~ '^[A-Z0-9]{4}$'
             AND (LENGTH(kode_sipil) != 4 OR kode_sipil !~ '^[A-Z0-9]{4}$')
        THEN 'Gunakan ME: ' || kode_me
        ELSE '⚠️ PERLU REVIEW MANUAL'
    END AS rekomendasi,
    nama_toko,
    cabang
FROM conflicting_ulok
ORDER BY nomor_ulok;

-- Strategy: Gunakan kode yang valid (4 karakter alfanumerik)
-- Jika SIPIL valid dan ME tidak → gunakan SIPIL
UPDATE toko t_me
SET 
    kode_toko = t_sipil.kode_toko,
    updated_at = now()
FROM toko t_sipil
WHERE t_sipil.nomor_ulok = t_me.nomor_ulok 
  AND t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND t_me.lingkup_pekerjaan = 'ME'
  AND t_sipil.kode_toko IS NOT NULL 
  AND LENGTH(t_sipil.kode_toko) = 4
  AND UPPER(t_sipil.kode_toko) ~ '^[A-Z0-9]{4}$'
  AND (t_me.kode_toko IS NULL 
       OR LENGTH(t_me.kode_toko) != 4 
       OR UPPER(t_me.kode_toko) !~ '^[A-Z0-9]{4}$');

SELECT 
    'CASE 3a completed: Used valid SIPIL kode for ME' AS result,
    COUNT(*) AS rows_updated
FROM toko t_me
JOIN backup_toko_kode_sync_2026_07_13 b ON b.id = t_me.id
JOIN toko t_sipil ON t_sipil.nomor_ulok = t_me.nomor_ulok AND t_sipil.lingkup_pekerjaan = 'SIPIL'
WHERE t_me.lingkup_pekerjaan = 'ME'
  AND b.kode_toko != t_me.kode_toko
  AND t_me.kode_toko = t_sipil.kode_toko;

-- Jika ME valid dan SIPIL tidak → gunakan ME
UPDATE toko t_sipil
SET 
    kode_toko = t_me.kode_toko,
    updated_at = now()
FROM toko t_me
WHERE t_me.nomor_ulok = t_sipil.nomor_ulok 
  AND t_me.lingkup_pekerjaan = 'ME'
  AND t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND t_me.kode_toko IS NOT NULL 
  AND LENGTH(t_me.kode_toko) = 4
  AND UPPER(t_me.kode_toko) ~ '^[A-Z0-9]{4}$'
  AND (t_sipil.kode_toko IS NULL 
       OR LENGTH(t_sipil.kode_toko) != 4 
       OR UPPER(t_sipil.kode_toko) !~ '^[A-Z0-9]{4}$');

SELECT 
    'CASE 3b completed: Used valid ME kode for SIPIL' AS result,
    COUNT(*) AS rows_updated
FROM toko t_sipil
JOIN backup_toko_kode_sync_2026_07_13 b ON b.id = t_sipil.id
JOIN toko t_me ON t_me.nomor_ulok = t_sipil.nomor_ulok AND t_me.lingkup_pekerjaan = 'ME'
WHERE t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND b.kode_toko != t_sipil.kode_toko
  AND t_sipil.kode_toko = t_me.kode_toko;

-- ============================================================
-- STEP 4: VERIFIKASI HASIL
-- ============================================================

SELECT 
    '4.1 Verifikasi: Masalah yang tersisa' AS step;

WITH ulok_check AS (
    SELECT 
        nomor_ulok,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) AS kode_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) AS kode_me,
        MAX(nama_toko) AS nama_toko
    FROM toko
    WHERE nomor_ulok IN (
        SELECT nomor_ulok 
        FROM toko 
        GROUP BY nomor_ulok 
        HAVING COUNT(*) > 1
    )
    GROUP BY nomor_ulok
)
SELECT 
    COUNT(*) AS total_ulok_multiple_lingkup,
    COUNT(*) FILTER (
        WHERE (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
           OR (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
           OR (kode_sipil != kode_me)
    ) AS masih_bermasalah,
    COUNT(*) FILTER (
        WHERE kode_sipil IS NOT NULL 
          AND kode_sipil != '' 
          AND kode_sipil != '-'
          AND kode_sipil != '----'
          AND kode_me IS NOT NULL 
          AND kode_me != '' 
          AND kode_me != '-'
          AND kode_me != '----'
          AND kode_sipil = kode_me
    ) AS sudah_sync
FROM ulok_check;

-- Tampilkan masalah yang masih tersisa (perlu review manual)
SELECT 
    '4.2 Masalah yang masih tersisa (perlu review manual)' AS step;

WITH remaining_issues AS (
    SELECT 
        nomor_ulok,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) AS kode_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) AS kode_me,
        MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN id END) AS id_sipil,
        MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN id END) AS id_me,
        MAX(nama_toko) AS nama_toko,
        MAX(cabang) AS cabang
    FROM toko
    WHERE nomor_ulok IN (
        SELECT nomor_ulok 
        FROM toko 
        GROUP BY nomor_ulok 
        HAVING COUNT(*) > 1
    )
    GROUP BY nomor_ulok
    HAVING 
        (MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) IS NULL 
         OR MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) = '' 
         OR MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) = '-'
         OR MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) = '----')
        OR (MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) IS NULL 
            OR MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) = '' 
            OR MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) = '-'
            OR MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END) = '----')
        OR (MAX(CASE WHEN lingkup_pekerjaan = 'SIPIL' THEN kode_toko END) != MAX(CASE WHEN lingkup_pekerjaan = 'ME' THEN kode_toko END))
)
SELECT 
    nomor_ulok,
    kode_sipil,
    kode_me,
    CASE 
        WHEN (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-' OR kode_sipil = '----')
             AND (kode_me IS NULL OR kode_me = '' OR kode_me = '-' OR kode_me = '----')
        THEN '❌ KEDUANYA KOSONG - BUTUH INPUT MANUAL'
        WHEN kode_sipil IS NOT NULL AND kode_me IS NOT NULL 
             AND kode_sipil != '' AND kode_me != ''
             AND kode_sipil != '-' AND kode_me != '-'
             AND kode_sipil != '----' AND kode_me != '----'
             AND kode_sipil != kode_me
        THEN '⚠️ KEDUANYA ADA TAPI BEDA - PILIH MANUAL'
        ELSE '⚠️ PERLU REVIEW'
    END AS status,
    nama_toko,
    cabang,
    id_sipil,
    id_me
FROM remaining_issues
ORDER BY 
    CASE 
        WHEN (kode_sipil IS NULL OR kode_sipil = '' OR kode_sipil = '-')
             AND (kode_me IS NULL OR kode_me = '' OR kode_me = '-')
        THEN 1
        ELSE 2
    END,
    nomor_ulok
LIMIT 30;

-- Tampilkan contoh yang berhasil di-sync
SELECT 
    '4.3 Contoh ULOK yang berhasil di-sync' AS step;

SELECT 
    t.nomor_ulok,
    b.lingkup_pekerjaan,
    b.kode_toko AS kode_lama,
    t.kode_toko AS kode_baru,
    t.nama_toko,
    t.cabang
FROM toko t
JOIN backup_toko_kode_sync_2026_07_13 b ON b.id = t.id
WHERE (b.kode_toko IS NULL OR b.kode_toko = '' OR b.kode_toko = '-' OR b.kode_toko = '----')
  AND (t.kode_toko IS NOT NULL AND t.kode_toko != '' AND t.kode_toko != '-' AND t.kode_toko != '----')
ORDER BY t.nomor_ulok, t.lingkup_pekerjaan
LIMIT 20;

-- ============================================================
-- STEP 5: CLEANUP (Optional)
-- ============================================================

-- Standardisasi kode_toko: trim spasi, uppercase
UPDATE toko
SET 
    kode_toko = UPPER(TRIM(kode_toko)),
    updated_at = now()
WHERE kode_toko IS NOT NULL 
  AND kode_toko != ''
  AND (kode_toko != UPPER(TRIM(kode_toko)));

SELECT 
    'Cleanup: Standardized kode_toko (uppercase, trimmed)' AS result,
    COUNT(*) AS rows_updated
FROM toko
WHERE kode_toko IS NOT NULL 
  AND kode_toko != ''
  AND updated_at > (SELECT MAX(backup_timestamp) FROM backup_toko_kode_sync_2026_07_13);

-- ============================================================
-- COMMIT ATAU ROLLBACK?
-- ============================================================

-- Jika hasil verifikasi OK, uncomment line berikut:
-- COMMIT;

-- Jika ada masalah, uncomment line berikut untuk rollback:
-- ROLLBACK;

-- ============================================================
-- CATATAN PENTING:
-- ============================================================
-- 1. Script ini menggunakan TRANSACTION untuk safety
-- 2. Tidak ada perubahan permanen sampai COMMIT dijalankan
-- 3. Backup tersimpan di: backup_toko_kode_sync_2026_07_13
-- 4. Review output STEP 4.2 untuk masalah yang perlu manual fix
-- 5. Untuk restore backup jika perlu:
--    UPDATE toko t SET kode_toko = b.kode_toko 
--    FROM backup_toko_kode_sync_2026_07_13 b WHERE t.id = b.id;
-- ============================================================

-- Print final instruction
SELECT 
    '=====================================' AS instruction
UNION ALL SELECT '⚠️  REVIEW HASIL DI ATAS'
UNION ALL SELECT '✅ Jika OK → Jalankan: COMMIT;'
UNION ALL SELECT '❌ Jika ada masalah → Jalankan: ROLLBACK;'
UNION ALL SELECT '=====================================';
