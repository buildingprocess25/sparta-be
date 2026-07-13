-- Fix ULOK UZ01-2606-0006 branch access issue for SIDOARJO coordinator approval
-- Issue: 403 Forbidden when SIDOARJO coordinator tries to approve RAB
-- Root cause: toko.cabang is not in SIDOARJO branch group

-- ============================================================================
-- STEP 1: Investigate current state
-- ============================================================================

-- Check current ULOK data
SELECT 
    'Current ULOK data' AS step,
    t.id,
    t.nomor_ulok,
    t.cabang,
    t.nama_toko,
    t.created_at
FROM toko t
WHERE t.nomor_ulok = 'UZ01-2606-0006';

-- Check related RAB
SELECT 
    'Related RAB' AS step,
    r.id,
    r.nomor_rab,
    r.status,
    r.nama_pt,
    r.created_at
FROM toko t
JOIN rab r ON r.toko_id = t.id
WHERE t.nomor_ulok = 'UZ01-2606-0006'
ORDER BY r.created_at DESC;

-- Check SIDOARJO coordinator users
SELECT 
    'SIDOARJO coordinators' AS step,
    email_sat,
    nama_lengkap,
    cabang,
    jabatan
FROM user_cabang
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND UPPER(jabatan) LIKE '%KOORDINATOR%'
ORDER BY nama_lengkap;

-- Check if SIDOARJO users have coverage (should be empty)
SELECT 
    'SIDOARJO coverage' AS step,
    uc.nama_lengkap,
    uc.cabang,
    ubc.covered_cabang
FROM user_cabang uc
LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(uc.cabang) LIKE '%SIDOARJO%'
  AND UPPER(uc.jabatan) LIKE '%KOORDINATOR%';

-- ============================================================================
-- STEP 2: Choose fix option based on investigation
-- ============================================================================

-- OPTION 1: Update toko.cabang to SIDOARJO (Recommended if ULOK should be SIDOARJO)
-- Uncomment to execute:
/*
UPDATE toko
SET cabang = 'SIDOARJO',
    updated_at = now()
WHERE nomor_ulok = 'UZ01-2606-0006'
  AND cabang != 'SIDOARJO';

-- Verify update
SELECT 
    'After update' AS step,
    id,
    nomor_ulok,
    cabang,
    nama_toko
FROM toko
WHERE nomor_ulok = 'UZ01-2606-0006';
*/

-- OPTION 2: Add user coverage for cross-branch approval
-- Use this if coordinator needs to approve documents from other branches
-- Replace 'ACTUAL_BRANCH' with the actual cabang from STEP 1
/*
INSERT INTO user_branch_coverage (user_cabang_id, covered_cabang, coverage_label)
SELECT 
    uc.id,
    'ACTUAL_BRANCH', -- Replace with actual branch from investigation
    'Cross-branch approval for UZ01-2606-0006'
FROM user_cabang uc
WHERE UPPER(uc.cabang) LIKE '%SIDOARJO%'
  AND UPPER(uc.jabatan) LIKE '%KOORDINATOR%'
ON CONFLICT (user_cabang_id, covered_cabang) DO NOTHING;

-- Verify coverage
SELECT 
    'After adding coverage' AS step,
    uc.nama_lengkap,
    uc.cabang,
    ubc.covered_cabang,
    ubc.coverage_label
FROM user_cabang uc
JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(uc.cabang) LIKE '%SIDOARJO%'
  AND UPPER(uc.jabatan) LIKE '%KOORDINATOR%';
*/

-- ============================================================================
-- STEP 3: Verification queries
-- ============================================================================

-- Check all documents for this ULOK
SELECT 
    'All documents for ULOK' AS step,
    'RAB' as doc_type,
    COUNT(*) as count
FROM toko t
JOIN rab r ON r.toko_id = t.id
WHERE t.nomor_ulok = 'UZ01-2606-0006'
UNION ALL
SELECT 
    'All documents for ULOK' AS step,
    'SPK' as doc_type,
    COUNT(*) as count
FROM toko t
JOIN spk s ON s.id_toko = t.id
WHERE t.nomor_ulok = 'UZ01-2606-0006'
UNION ALL
SELECT 
    'All documents for ULOK' AS step,
    'Gantt' as doc_type,
    COUNT(*) as count
FROM toko t
JOIN gantt_chart g ON g.id_toko = t.id
WHERE t.nomor_ulok = 'UZ01-2606-0006';

-- Final state check
SELECT 
    'Final state' AS step,
    t.nomor_ulok,
    t.cabang,
    t.nama_toko,
    r.id as rab_id,
    r.nomor_rab,
    r.status as rab_status
FROM toko t
LEFT JOIN rab r ON r.toko_id = t.id
WHERE t.nomor_ulok = 'UZ01-2606-0006'
ORDER BY r.created_at DESC;
