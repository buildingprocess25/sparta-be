-- QUICK CHECK: CV EVLOGIA JAYA
-- Jalankan query ini dan share hasilnya

-- 1. User role
SELECT 
    email,
    role,
    cabang,
    nama_pt
FROM user_cabang 
WHERE nama_pt LIKE '%EVLOGIA%'
LIMIT 5;

-- 2. Apakah ada RAB pending untuk EVLOGIA?
SELECT COUNT(*) as total_pending_rab
FROM rabs r
LEFT JOIN toko t ON r.kode_toko = t.kode_toko
WHERE t.nama_kontraktor LIKE '%EVLOGIA%'
  AND r.status LIKE '%Menunggu%';

-- 3. Apakah ada OPNAME pending untuk EVLOGIA?
SELECT COUNT(*) as total_pending_opname
FROM opname_final o
LEFT JOIN toko t ON o.id_toko = t.id
WHERE (o.nama_kontraktor LIKE '%EVLOGIA%' OR t.nama_kontraktor LIKE '%EVLOGIA%')
  AND o.status_opname_final LIKE '%Menunggu%';

-- 4. Format nama kontraktor di toko
SELECT DISTINCT nama_kontraktor
FROM toko
WHERE nama_kontraktor LIKE '%EVLOGIA%';
