-- Debug: List all kontraktor by cabang
-- Run this to verify which contractors should appear for each branch

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

-- 3. Combined (sama seperti query di backend)
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
) AS combined
WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
ORDER BY cabang, nama_kontraktor;

-- 4. Count by cabang
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
) AS combined
WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
GROUP BY cabang
ORDER BY cabang;

-- 5. Specific cabang (contoh: BALI)
-- Ganti 'BALI' dengan cabang yang kamu test
SELECT DISTINCT nama_kontraktor
FROM (
    SELECT DISTINCT 
        TRIM(ps.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
    FROM pengajuan_spk ps
    LEFT JOIN toko t ON t.id = ps.id_toko
    WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL
      AND UPPER(TRIM(COALESCE(t.cabang, ''))) = 'BALI'
    
    UNION
    
    SELECT DISTINCT 
        TRIM(t.nama_kontraktor) AS nama_kontraktor,
        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
    FROM toko t
    WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL
      AND UPPER(TRIM(COALESCE(t.cabang, ''))) = 'BALI'
) AS combined
WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
ORDER BY nama_kontraktor;
