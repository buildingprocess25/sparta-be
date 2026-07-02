-- ============================================================================
-- DEBUG: SIDOARJO Branch Access Issue
-- Date: 2 Juli 2026
-- Problem: Coordinator SIDOARJO tidak lihat dokumen dari "SIDOARJO BPN SMD"
-- ============================================================================

-- 1. Check all SIDOARJO branch variants in database
SELECT 
    '1. All SIDOARJO branch variants' AS debug_step,
    cabang AS original_value,
    UPPER(TRIM(cabang)) AS normalized,
    COUNT(*) AS toko_count
FROM toko
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
GROUP BY cabang
ORDER BY COUNT(*) DESC;

-- 2. Check RAB documents per SIDOARJO branch
SELECT 
    '2. RAB documents per SIDOARJO branch' AS debug_step,
    t.cabang,
    COUNT(r.id) AS rab_count,
    STRING_AGG(DISTINCT r.status, ', ') AS statuses,
    MIN(r.created_at)::date AS oldest_rab,
    MAX(r.created_at)::date AS newest_rab
FROM toko t
LEFT JOIN rab r ON r.id_toko = t.id
WHERE UPPER(t.cabang) LIKE '%SIDOARJO%'
GROUP BY t.cabang
ORDER BY t.cabang;

-- 3. Sample RAB documents from SIDOARJO BPN SMD
SELECT 
    '3. Sample RAB from SIDOARJO BPN SMD' AS debug_step,
    r.id,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang AS cabang_original,
    UPPER(TRIM(t.cabang)) AS cabang_normalized,
    r.status,
    r.created_at::date
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE t.cabang ILIKE '%SIDOARJO%BPN%'
ORDER BY r.created_at DESC
LIMIT 10;

-- 4. Check user_cabang for SIDOARJO coordinators
SELECT 
    '4. SIDOARJO coordinator users' AS debug_step,
    id,
    nama_lengkap,
    email_sat,
    cabang AS cabang_login,
    UPPER(TRIM(cabang)) AS cabang_normalized,
    jabatan,
    roles
FROM user_cabang
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(jabatan) LIKE '%KOORDINATOR%' OR UPPER(jabatan) LIKE '%COORDINATOR%')
ORDER BY nama_lengkap;

-- 5. Check if SIDOARJO users have coverage entries (they shouldn't for non-CIKOKOL/CILEUNGSI)
SELECT 
    '5. SIDOARJO user_branch_coverage (should be empty)' AS debug_step,
    uc.nama_lengkap,
    uc.email_sat,
    uc.cabang AS login_branch,
    ubc.covered_cabang,
    ubc.coverage_label
FROM user_cabang uc
LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(uc.cabang) LIKE '%SIDOARJO%'
ORDER BY uc.nama_lengkap, ubc.covered_cabang;

-- 6. Test expected branches for SIDOARJO users
-- According to business rules, SIDOARJO users should see:
-- SIDOARJO, SIDOARJO BPN SMD, MANOKWARI, NTT, SORONG
WITH expected_branches AS (
    SELECT UNNEST(ARRAY['SIDOARJO', 'SIDOARJO BPN SMD', 'MANOKWARI', 'NTT', 'SORONG']) AS branch_name
)
SELECT 
    '6. Expected SIDOARJO branch group documents' AS debug_step,
    eb.branch_name,
    COUNT(DISTINCT r.id) AS rab_count,
    COUNT(DISTINCT spk.id) AS spk_count,
    COUNT(DISTINCT ofn.id) AS ktk_count
FROM expected_branches eb
LEFT JOIN toko t ON UPPER(TRIM(t.cabang)) = UPPER(TRIM(eb.branch_name))
LEFT JOIN rab r ON r.id_toko = t.id
LEFT JOIN spk spk ON spk.id_toko = t.id
LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
GROUP BY eb.branch_name
ORDER BY eb.branch_name;

-- 7. Check for underscore vs space variations
SELECT 
    '7. Underscore vs space check' AS debug_step,
    t.cabang AS original,
    REPLACE(REPLACE(UPPER(TRIM(t.cabang)), '_', ' '), '  ', ' ') AS normalized_with_underscore_fix,
    COUNT(*) AS count
FROM toko t
WHERE t.cabang ILIKE '%BPN%'
GROUP BY t.cabang
ORDER BY t.cabang;

-- 8. What a SIDOARJO coordinator should see (simulation)
WITH sidoarjo_group AS (
    SELECT UNNEST(ARRAY['SIDOARJO', 'SIDOARJO BPN SMD', 'MANOKWARI', 'NTT', 'SORONG']) AS allowed_branch
)
SELECT 
    '8. Simulated SIDOARJO coordinator view' AS debug_step,
    r.id AS rab_id,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    r.status,
    r.created_at::date
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE UPPER(TRIM(t.cabang)) = ANY(ARRAY(SELECT UPPER(TRIM(allowed_branch)) FROM sidoarjo_group))
ORDER BY r.created_at DESC
LIMIT 20;

-- 9. Check if normalization would match
SELECT 
    '9. Normalization test' AS debug_step,
    cabang AS original,
    UPPER(TRIM(REPLACE(REPLACE(cabang, '_', ' '), '  ', ' '))) AS after_normalization,
    CASE 
        WHEN UPPER(TRIM(REPLACE(REPLACE(cabang, '_', ' '), '  ', ' '))) = 'SIDOARJO BPN SMD' 
        THEN 'MATCH'
        ELSE 'NO MATCH'
    END AS match_status,
    COUNT(*) AS toko_count
FROM toko
WHERE cabang ILIKE '%BPN%'
GROUP BY cabang
ORDER BY cabang;

-- 10. Check recent auth_session for SIDOARJO users
SELECT 
    '10. Recent SIDOARJO user sessions' AS debug_step,
    email_sat,
    cabang,
    jabatan,
    roles,
    expires_at,
    created_at
FROM auth_session
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- Step 2: Should show documents in both "SIDOARJO" and "SIDOARJO BPN SMD"
-- Step 6: Should show counts for all 5 branches in SIDOARJO group
-- Step 8: Should return documents from all 5 branches
-- Step 9: Should show "MATCH" after normalization
-- 
-- If Step 2 shows "SIDOARJO BPN_SMD" (underscore), that's the problem!
-- If Step 8 returns less than expected, branch filtering is working but data is missing
-- ============================================================================
