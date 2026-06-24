-- =========================================================================
-- DIAGNOSTIC SCRIPT: Debug Duplicate ULOK Issue
-- =========================================================================
-- Script ini akan mengidentifikasi:
-- 1. Apakah ada toko dengan ULOK yang sama tapi lingkup berbeda (atau NULL)
-- 2. Apakah ada RAB yang aktif di toko-toko tersebut
-- 3. Data corruption yang mungkin menyebabkan false positive duplicate

-- =========================================================================
-- QUERY 1: Tampilkan semua toko yang punya ULOK yang sama (case-insensitive)
-- =========================================================================
SELECT 
    UPPER(TRIM(nomor_ulok)) AS ulok_normalized,
    COUNT(*) AS jumlah_toko,
    STRING_AGG(DISTINCT id::text, ', ' ORDER BY id::text) AS toko_ids,
    STRING_AGG(DISTINCT COALESCE(lingkup_pekerjaan, '(NULL)'), ' | ' ORDER BY COALESCE(lingkup_pekerjaan, '(NULL)')) AS lingkup_list,
    STRING_AGG(DISTINCT COALESCE(nama_toko, '(no name)'), ' | ' ORDER BY COALESCE(nama_toko, '(no name)')) AS toko_names
FROM toko
GROUP BY UPPER(TRIM(nomor_ulok))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, UPPER(TRIM(nomor_ulok));

-- =========================================================================
-- QUERY 2: Detail toko duplicate dengan info RAB aktif nya
-- =========================================================================
WITH duplicate_uloks AS (
    SELECT UPPER(TRIM(nomor_ulok)) AS ulok_normalized
    FROM toko
    GROUP BY UPPER(TRIM(nomor_ulok))
    HAVING COUNT(*) > 1
),
toko_with_rab AS (
    SELECT 
        t.id AS toko_id,
        t.nomor_ulok,
        COALESCE(t.lingkup_pekerjaan, '(NULL)') AS lingkup,
        t.nama_toko,
        t.cabang,
        r.id AS rab_id,
        r.status AS rab_status,
        r.created_at AS rab_created_at
    FROM toko t
    LEFT JOIN rab r ON r.id_toko = t.id
    INNER JOIN duplicate_uloks du ON UPPER(TRIM(t.nomor_ulok)) = du.ulok_normalized
)
SELECT 
    nomor_ulok,
    toko_id,
    lingkup,
    nama_toko,
    cabang,
    COUNT(rab_id) FILTER (WHERE rab_status NOT IN ('REJECTED_BY_DIREKTUR', 'REJECTED_BY_KOORDINATOR', 'REJECTED_BY_MANAGER')) AS jumlah_rab_aktif,
    STRING_AGG(DISTINCT rab_id::text, ', ' ORDER BY rab_id::text) FILTER (WHERE rab_status NOT IN ('REJECTED_BY_DIREKTUR', 'REJECTED_BY_KOORDINATOR', 'REJECTED_BY_MANAGER')) AS rab_aktif_ids,
    STRING_AGG(DISTINCT rab_status, ' | ' ORDER BY rab_status) AS all_rab_statuses
FROM toko_with_rab
GROUP BY nomor_ulok, toko_id, lingkup, nama_toko, cabang
ORDER BY nomor_ulok, lingkup;

-- =========================================================================
-- QUERY 3: Cari toko yang punya ULOK berbeda secara case-sensitive saja
-- =========================================================================
-- Ini akan show toko yang duplicate karena case-sensitivity
-- Example: 'KZ01-240624-001' vs 'kz01-240624-001'
SELECT 
    t1.id AS toko_id_1,
    t1.nomor_ulok AS ulok_1,
    t1.lingkup_pekerjaan AS lingkup_1,
    t2.id AS toko_id_2,
    t2.nomor_ulok AS ulok_2,
    t2.lingkup_pekerjaan AS lingkup_2,
    CASE 
        WHEN EXISTS(SELECT 1 FROM rab WHERE id_toko = t1.id AND status NOT IN ('REJECTED_BY_DIREKTUR', 'REJECTED_BY_KOORDINATOR', 'REJECTED_BY_MANAGER'))
        THEN 'YES' 
        ELSE 'NO' 
    END AS t1_has_active_rab,
    CASE 
        WHEN EXISTS(SELECT 1 FROM rab WHERE id_toko = t2.id AND status NOT IN ('REJECTED_BY_DIREKTUR', 'REJECTED_BY_KOORDINATOR', 'REJECTED_BY_MANAGER'))
        THEN 'YES' 
        ELSE 'NO' 
    END AS t2_has_active_rab
FROM toko t1
INNER JOIN toko t2 
    ON UPPER(TRIM(t1.nomor_ulok)) = UPPER(TRIM(t2.nomor_ulok))
    AND t1.nomor_ulok != t2.nomor_ulok  -- Different case
    AND t1.id < t2.id  -- Prevent duplicate pairs
ORDER BY t1.nomor_ulok;

-- =========================================================================
-- QUERY 4: Cari toko dengan lingkup yang tidak normalized
-- =========================================================================
SELECT 
    id,
    nomor_ulok,
    lingkup_pekerjaan,
    lingkup_pekerjaan AS original_value,
    UPPER(TRIM(lingkup_pekerjaan)) AS should_be,
    CASE 
        WHEN lingkup_pekerjaan IS NULL THEN 'NULL (OK)'
        WHEN lingkup_pekerjaan = '' THEN 'EMPTY STRING (SHOULD BE NULL)'
        WHEN lingkup_pekerjaan != UPPER(TRIM(lingkup_pekerjaan)) THEN 'NOT NORMALIZED'
        WHEN UPPER(TRIM(lingkup_pekerjaan)) NOT IN ('SIPIL', 'ME') THEN 'INVALID VALUE'
        ELSE 'OK'
    END AS status_lingkup
FROM toko
WHERE lingkup_pekerjaan IS NULL
   OR lingkup_pekerjaan = ''
   OR lingkup_pekerjaan != UPPER(TRIM(lingkup_pekerjaan))
   OR UPPER(TRIM(lingkup_pekerjaan)) NOT IN ('SIPIL', 'ME')
ORDER BY nomor_ulok, id;

-- =========================================================================
-- QUERY 5: Cari toko dengan ULOK yang tidak normalized (case issue)
-- =========================================================================
SELECT 
    id,
    nomor_ulok,
    lingkup_pekerjaan,
    UPPER(TRIM(nomor_ulok)) AS should_be_ulok,
    CASE 
        WHEN nomor_ulok != UPPER(TRIM(nomor_ulok)) THEN 'NOT NORMALIZED'
        ELSE 'OK'
    END AS status_ulok
FROM toko
WHERE nomor_ulok != UPPER(TRIM(nomor_ulok))
ORDER BY nomor_ulok;

-- =========================================================================
-- QUERY 6: Test query backend yang dipakai untuk cek duplicate
-- =========================================================================
-- Simulasi query backend: findByNomorUlokAndLingkup
-- Parameter: $1 = 'KZ01-240624-001', $2 = 'SIPIL'

DO $$
DECLARE
    test_ulok TEXT := 'KZ01-240624-001';  -- Ganti dengan ULOK yang bermasalah
    test_lingkup TEXT := 'SIPIL';          -- Ganti dengan lingkup yang bermasalah
    result_count INT;
BEGIN
    -- Test query LAMA (yang broken)
    SELECT COUNT(*) INTO result_count
    FROM toko
    WHERE UPPER(nomor_ulok) = UPPER(test_ulok)
      AND COALESCE(lingkup_pekerjaan, '') = UPPER(TRIM(COALESCE(test_lingkup, '')));
    
    RAISE NOTICE 'Query LAMA (broken) found % toko', result_count;
    
    -- Test query BARU (yang fixed)
    SELECT COUNT(*) INTO result_count
    FROM toko
    WHERE UPPER(TRIM(nomor_ulok)) = UPPER(TRIM(test_ulok))
      AND UPPER(TRIM(COALESCE(lingkup_pekerjaan, ''))) = UPPER(TRIM(COALESCE(test_lingkup, '')));
    
    RAISE NOTICE 'Query BARU (fixed) found % toko', result_count;
END $$;

-- =========================================================================
-- QUERY 7: Identifikasi specific ULOK yang reported user
-- =========================================================================
-- Ganti dengan ULOK yang user report bermasalah
-- Uncomment dan run manual:

/*
SELECT 
    t.id AS toko_id,
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    t.nama_toko,
    t.cabang,
    r.id AS rab_id,
    r.status AS rab_status,
    r.email_pembuat,
    r.created_at
FROM toko t
LEFT JOIN rab r ON r.id_toko = t.id
WHERE UPPER(TRIM(t.nomor_ulok)) = UPPER(TRIM('KZ01-240624-001'))  -- Ganti dengan ULOK yang bermasalah
ORDER BY t.id, r.created_at DESC;
*/

-- =========================================================================
-- OUTPUT SUMMARY
-- =========================================================================
SELECT 
    'Total toko' AS metric,
    COUNT(*) AS value
FROM toko
UNION ALL
SELECT 
    'Toko dengan duplicate ULOK (case-insensitive)',
    COUNT(DISTINCT UPPER(TRIM(nomor_ulok)))
FROM toko
WHERE UPPER(TRIM(nomor_ulok)) IN (
    SELECT UPPER(TRIM(nomor_ulok))
    FROM toko
    GROUP BY UPPER(TRIM(nomor_ulok))
    HAVING COUNT(*) > 1
)
UNION ALL
SELECT 
    'Toko dengan lingkup tidak normalized',
    COUNT(*)
FROM toko
WHERE lingkup_pekerjaan IS NOT NULL
  AND (lingkup_pekerjaan = '' 
       OR lingkup_pekerjaan != UPPER(TRIM(lingkup_pekerjaan))
       OR UPPER(TRIM(lingkup_pekerjaan)) NOT IN ('SIPIL', 'ME'))
UNION ALL
SELECT 
    'Toko dengan ULOK tidak normalized',
    COUNT(*)
FROM toko
WHERE nomor_ulok != UPPER(TRIM(nomor_ulok))
UNION ALL
SELECT 
    'Total RAB aktif (non-rejected)',
    COUNT(*)
FROM rab
WHERE status NOT IN ('REJECTED_BY_DIREKTUR', 'REJECTED_BY_KOORDINATOR', 'REJECTED_BY_MANAGER');
