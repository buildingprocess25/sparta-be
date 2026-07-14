-- DIAGNOSE: Kenapa kontraktor dari user_cabang tidak muncul?
-- Run query ini untuk debug

-- 1. Check apakah ada kontraktor users di user_cabang table
SELECT 
    COUNT(*) AS total_kontraktor_users,
    COUNT(DISTINCT cabang) AS total_cabang
FROM user_cabang
WHERE UPPER(TRIM(role)) = 'KONTRAKTOR'
  AND NULLIF(TRIM(jabatan), '') IS NOT NULL;

-- 2. List all kontraktor users dengan detail
SELECT 
    id,
    email_sat,
    nama,
    TRIM(jabatan) AS nama_kontraktor,
    UPPER(TRIM(cabang)) AS cabang,
    UPPER(TRIM(role)) AS role
FROM user_cabang
WHERE UPPER(TRIM(role)) = 'KONTRAKTOR'
  AND NULLIF(TRIM(jabatan), '') IS NOT NULL
ORDER BY cabang, nama_kontraktor;

-- 3. Khusus BALI kontraktor users
SELECT 
    id,
    email_sat,
    nama,
    TRIM(jabatan) AS nama_kontraktor,
    UPPER(TRIM(cabang)) AS cabang,
    UPPER(TRIM(role)) AS role
FROM user_cabang
WHERE UPPER(TRIM(role)) = 'KONTRAKTOR'
  AND NULLIF(TRIM(jabatan), '') IS NOT NULL
  AND UPPER(TRIM(cabang)) = 'BALI'
ORDER BY nama_kontraktor;

-- 4. Check field structure (sample 5 rows)
SELECT 
    id,
    email_sat,
    nama,
    jabatan,  -- Raw value
    cabang,   -- Raw value
    role      -- Raw value
FROM user_cabang
LIMIT 5;

-- 5. Check apakah ada user dengan role yang mirip KONTRAKTOR
SELECT DISTINCT 
    UPPER(TRIM(role)) AS role,
    COUNT(*) AS jumlah
FROM user_cabang
GROUP BY UPPER(TRIM(role))
ORDER BY role;

-- 6. List semua users di BALI (any role)
SELECT 
    id,
    email_sat,
    nama,
    jabatan,
    cabang,
    role
FROM user_cabang
WHERE UPPER(TRIM(cabang)) = 'BALI'
ORDER BY role, nama;
