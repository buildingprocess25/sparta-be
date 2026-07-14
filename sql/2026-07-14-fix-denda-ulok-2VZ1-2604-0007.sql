-- ============================================
-- FIX DENDA: ULOK 2VZ1-2604-0007
-- Date: 2026-07-14
-- Issue: ME masih kena denda padahal ada pertambahan SPK
-- ============================================

-- Step 1: Check current state (BEFORE)
SELECT 
    '=== BEFORE FIX ===' as status,
    t.nomor_ulok,
    t.id as toko_id,
    t.nama_toko,
    ps.lingkup_pekerjaan,
    ps.nomor_spk,
    of.nilai_denda,
    of.hari_denda,
    of.tanggal_akhir_spk_denda
FROM opname_final of
JOIN toko t ON t.id = of.id_toko
JOIN pengajuan_spk ps ON ps.id_toko = t.id
WHERE t.nomor_ulok = '2VZ1-2604-0007'
  AND ps.status = 'SPK_APPROVED'
ORDER BY ps.lingkup_pekerjaan;

-- Step 2: FIX - Update denda to 0 with correct SPK end date
UPDATE opname_final
SET nilai_denda = 0,
    hari_denda = 0,
    tanggal_akhir_spk_denda = '2026-07-15'
WHERE id_toko IN (
    SELECT t.id
    FROM toko t
    WHERE t.nomor_ulok = '2VZ1-2604-0007'
);

-- Step 3: Verify fix (AFTER)
SELECT 
    '=== AFTER FIX ===' as status,
    t.nomor_ulok,
    t.id as toko_id,
    t.nama_toko,
    ps.lingkup_pekerjaan,
    ps.nomor_spk,
    of.nilai_denda,
    of.hari_denda,
    of.tanggal_akhir_spk_denda,
    CASE 
        WHEN of.nilai_denda = 0 THEN '✅ FIXED'
        ELSE '❌ STILL HAS DENDA'
    END as fix_status
FROM opname_final of
JOIN toko t ON t.id = of.id_toko
JOIN pengajuan_spk ps ON ps.id_toko = t.id
WHERE t.nomor_ulok = '2VZ1-2604-0007'
  AND ps.status = 'SPK_APPROVED'
ORDER BY ps.lingkup_pekerjaan;

-- Expected Result:
-- SIPIL: nilai_denda = 0, tanggal_akhir_spk_denda = 2026-07-15
-- ME:    nilai_denda = 0, tanggal_akhir_spk_denda = 2026-07-15
