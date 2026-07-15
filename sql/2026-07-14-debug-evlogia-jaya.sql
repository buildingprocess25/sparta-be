-- DEBUG SCRIPT: CV EVLOGIA JAYA DIREKTUR KONTRAKTOR
-- Investigasi kenapa RAB dan OPNAME tidak muncul

-- 1. CHECK USER DATA
SELECT 
    '=== USER DATA - CV EVLOGIA JAYA ===' as section;

SELECT 
    id,
    email,
    nama,
    role,
    cabang,
    nama_pt,
    branch_group
FROM user_cabang 
WHERE nama_pt LIKE '%EVLOGIA%'
ORDER BY email;

-- 2. CHECK RAB DATA
SELECT 
    '=== RAB DATA - EVLOGIA JAYA ===' as section;

SELECT 
    r.id,
    r.nama_toko,
    r.cabang,
    r.lingkup_pekerjaan,
    r.status,
    t.nama_kontraktor,
    t.kode_toko,
    r.created_at
FROM rabs r
LEFT JOIN toko t ON r.kode_toko = t.kode_toko
WHERE t.nama_kontraktor LIKE '%EVLOGIA%'
ORDER BY r.created_at DESC
LIMIT 20;

-- 3. CHECK OPNAME DATA
SELECT 
    '=== OPNAME DATA - EVLOGIA JAYA ===' as section;

SELECT 
    o.id,
    o.nomor_ulok,
    o.cabang,
    o.status_opname_final,
    o.nama_kontraktor as opname_nama_kontraktor,
    t.nama_kontraktor as toko_nama_kontraktor,
    o.created_at
FROM opname_final o
LEFT JOIN toko t ON o.id_toko = t.id
WHERE o.nama_kontraktor LIKE '%EVLOGIA%' 
   OR t.nama_kontraktor LIKE '%EVLOGIA%'
ORDER BY o.created_at DESC
LIMIT 20;

-- 4. CHECK PENDING DIREKTUR RAB
SELECT 
    '=== PENDING RAB FOR DIREKTUR ===' as section;

SELECT 
    r.id,
    r.nama_toko,
    r.cabang,
    r.status,
    t.nama_kontraktor
FROM rabs r
LEFT JOIN toko t ON r.kode_toko = t.kode_toko
WHERE t.nama_kontraktor LIKE '%EVLOGIA%'
  AND r.status LIKE '%Menunggu%Direktur%'
ORDER BY r.created_at DESC;

-- 5. CHECK PENDING DIREKTUR OPNAME
SELECT 
    '=== PENDING OPNAME FOR DIREKTUR ===' as section;

SELECT 
    o.id,
    o.nomor_ulok,
    o.cabang,
    o.status_opname_final,
    o.nama_kontraktor as opname_nama_kontraktor,
    t.nama_kontraktor as toko_nama_kontraktor
FROM opname_final o
LEFT JOIN toko t ON o.id_toko = t.id
WHERE (o.nama_kontraktor LIKE '%EVLOGIA%' OR t.nama_kontraktor LIKE '%EVLOGIA%')
  AND o.status_opname_final LIKE '%Menunggu%Direktur%'
ORDER BY o.created_at DESC;

-- 6. STATUS DISTRIBUTION FOR RAB
SELECT 
    '=== RAB STATUS DISTRIBUTION ===' as section;

SELECT 
    r.status,
    COUNT(*) as count
FROM rabs r
LEFT JOIN toko t ON r.kode_toko = t.kode_toko
WHERE t.nama_kontraktor LIKE '%EVLOGIA%'
GROUP BY r.status
ORDER BY count DESC;

-- 7. STATUS DISTRIBUTION FOR OPNAME
SELECT 
    '=== OPNAME STATUS DISTRIBUTION ===' as section;

SELECT 
    o.status_opname_final as status,
    COUNT(*) as count
FROM opname_final o
LEFT JOIN toko t ON o.id_toko = t.id
WHERE o.nama_kontraktor LIKE '%EVLOGIA%' 
   OR t.nama_kontraktor LIKE '%EVLOGIA%'
GROUP BY o.status_opname_final
ORDER BY count DESC;

-- 8. COMPANY NAME VARIATIONS CHECK
SELECT 
    '=== COMPANY NAME VARIATIONS ===' as section;

-- Check all unique company names in toko table
SELECT DISTINCT nama_kontraktor
FROM toko
WHERE nama_kontraktor LIKE '%EVLOGIA%';

-- Check all unique company names in opname_final table
SELECT DISTINCT nama_kontraktor
FROM opname_final
WHERE nama_kontraktor LIKE '%EVLOGIA%';

-- Check all unique nama_pt in user_cabang table
SELECT DISTINCT nama_pt
FROM user_cabang
WHERE nama_pt LIKE '%EVLOGIA%';
