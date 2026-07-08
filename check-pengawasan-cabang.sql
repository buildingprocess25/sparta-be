-- Script untuk debug Pengawasan filter issue
-- Check cabang values di data pengawasan

-- 1. Check semua cabang yang ada di pengawasan (via gantt_chart -> toko)
SELECT DISTINCT t.cabang, COUNT(*) as total_pengawasan
FROM pengawasan p
JOIN gantt_chart g ON g.id = p.id_gantt
JOIN toko t ON t.id = g.id_toko
GROUP BY t.cabang
ORDER BY t.cabang;

-- 2. Check apakah ada data dengan cabang LUWU
SELECT COUNT(*) as luwu_count
FROM pengawasan p
JOIN gantt_chart g ON g.id = p.id_gantt
JOIN toko t ON t.id = g.id_toko
WHERE UPPER(t.cabang) = 'LUWU';

-- 3. Check sample data untuk LUWU
SELECT p.id, p.kategori_pekerjaan, t.cabang, t.nomor_ulok, t.nama_toko
FROM pengawasan p
JOIN gantt_chart g ON g.id = p.id_gantt
JOIN toko t ON t.id = g.id_toko
WHERE UPPER(t.cabang) = 'LUWU'
LIMIT 10;

-- 4. Check data coordinator Luwu di user_cabang
SELECT id, email_sat, cabang, role
FROM user_cabang
WHERE UPPER(cabang) LIKE '%LUWU%'
OR UPPER(email_sat) LIKE '%luwu%';

-- 5. Check apakah ada branch coverage untuk user Luwu
SELECT uc.email_sat, uc.cabang, ubc.covered_cabang
FROM user_cabang uc
LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(uc.cabang) LIKE '%LUWU%';

-- 6. Check sample pengawasan data dengan berbagai cabang
SELECT t.cabang, t.nomor_ulok, COUNT(*) as count
FROM pengawasan p
JOIN gantt_chart g ON g.id = p.id_gantt
JOIN toko t ON t.id = g.id_toko
GROUP BY t.cabang, t.nomor_ulok
ORDER BY t.cabang, t.nomor_ulok
LIMIT 50;
