-- Debug: List all kontraktor by cabang
-- Run this to verify which contractors should appear for each branch
-- ✅ UPDATED 2026-07-14: Now includes user_cabang table (kontraktor users)

-- 1. Kontraktor dari pengajuan_spk
SELECT DISTINCT 
    TRIM(ps.nama_kontraktor) AS nama_kontraktor,
    UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang,
    'pengajuan_spk' AS source
FROM pengajuan_spk ps
LEFT JOIN toko t ON t.id = ps.id_toko
WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL
  AND UPPER(TRIM(ps.nama_kontraktor)) <> 'HEAD OFFICE'
ORDER BY cabang, nama_kontraktor;

-- 2. Kontraktor dari toko
SELECT DISTINCT 
    TRIM(t.nama_kontraktor) AS nama_kontraktor,
    UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang,
    'toko' AS source
FROM toko t
WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL
  AND UPPER(TRIM(t.nama_kontraktor)) <> 'HEAD OFFICE'
ORDER BY cabang, nama_kontraktor;

-- 3. Kontraktor dari user_cabang (kontraktor users)
SELECT DISTINCT 
    TRIM(uc.jabatan) AS nama_kontraktor,
    UPPER(TRIM(COALESCE(uc.cabang, 'UNKNOWN'))) AS cabang,
    'user_cabang' AS source
FROM user_cabang uc
WHERE UPPER(TRIM(uc.role)) = 'KONTRAKTOR'
  AND NULLIF(TRIM(uc.jabatan), '') IS NOT NULL
  AND UPPER(TRIM(uc.jabatan)) <> 'HEAD OFFICE'
ORDER BY cabang, nama_kontraktor;


-- 4. Combined (sama seperti query di backend - UPDATED with user_cabang)
SELECT DISTINCT nama_kontraktor, cabang
FROM (
    SELECT DISTINCT 
        TRIM(ps.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
    FROM pengajuan_spk ps
    LEFT JOIN toko t ON t.id = ps.id_toko
    WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL
    
    UNION
    
    SELECT DISTINCT 
        TRIM(t.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
    FROM toko t
    WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL
    
    UNION
    
    SELECT DISTINCT 
        TRIM(uc.jabatan) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(uc.cabang, 'UNKNOWN'))) AS cabang
    FROM user_cabang uc
    WHERE UPPER(TRIM(uc.role)) = 'KONTRAKTOR'
      AND NULLIF(TRIM(uc.jabatan), '') IS NOT NULL
) AS combined
WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
ORDER BY cabang, nama_kontraktor;

-- 5. Count by cabang (UPDATED with user_cabang)
SELECT 
    cabang,
    COUNT(DISTINCT nama_kontraktor) AS total_kontraktor
FROM (
    SELECT DISTINCT 
        TRIM(ps.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
    FROM pengajuan_spk ps
    LEFT JOIN toko t ON t.id = ps.id_toko
    WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL
    
    UNION
    
    SELECT DISTINCT 
        TRIM(t.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
    FROM toko t
    WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL
    
    UNION
    
    SELECT DISTINCT 
        TRIM(uc.jabatan) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(uc.cabang, 'UNKNOWN'))) AS cabang
    FROM user_cabang uc
    WHERE UPPER(TRIM(uc.role)) = 'KONTRAKTOR'
      AND NULLIF(TRIM(uc.jabatan), '') IS NOT NULL
) AS combined
WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
GROUP BY cabang
ORDER BY cabang;

-- 6. Specific cabang: BALI (contoh)
-- Ganti 'BALI' dengan cabang yang kamu test
SELECT DISTINCT nama_kontraktor, source
FROM (
    SELECT DISTINCT 
        TRIM(ps.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang,
        'pengajuan_spk' AS source
    FROM pengajuan_spk ps
    LEFT JOIN toko t ON t.id = ps.id_toko
    WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL
      AND UPPER(TRIM(COALESCE(t.cabang, ''))) = 'BALI'
    
    UNION
    
    SELECT DISTINCT 
        TRIM(t.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang,
        'toko' AS source
    FROM toko t
    WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL
      AND UPPER(TRIM(COALESCE(t.cabang, ''))) = 'BALI'
    
    UNION
    
    SELECT DISTINCT 
        TRIM(uc.jabatan) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(uc.cabang, 'UNKNOWN'))) AS cabang,
        'user_cabang' AS source
    FROM user_cabang uc
    WHERE UPPER(TRIM(uc.role)) = 'KONTRAKTOR'
      AND NULLIF(TRIM(uc.jabatan), '') IS NOT NULL
      AND UPPER(TRIM(COALESCE(uc.cabang, ''))) = 'BALI'
) AS combined
WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
ORDER BY nama_kontraktor;

-- 7. Verify BALI contractors from user_cabang specifically
SELECT 
    TRIM(uc.email_sat) AS email,
    TRIM(uc.jabatan) AS nama_kontraktor,
    UPPER(TRIM(uc.cabang)) AS cabang,
    UPPER(TRIM(uc.role)) AS role
FROM user_cabang uc
WHERE UPPER(TRIM(uc.cabang)) = 'BALI'
  AND UPPER(TRIM(uc.role)) = 'KONTRAKTOR'
ORDER BY uc.jabatan;
