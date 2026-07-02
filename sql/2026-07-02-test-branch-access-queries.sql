-- Test queries untuk verify branch access logic setelah restrukturisasi

-- ============================================================================
-- 1. Check user_branch_coverage table structure
-- ============================================================================
SELECT 
    'user_branch_coverage table structure' AS test_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_branch_coverage'
ORDER BY ordinal_position;

-- ============================================================================
-- 2. Find users dengan cabang CIKOKOL atau CILEUNGSI (cabang induk)
-- ============================================================================
SELECT 
    '2. Users with parent branch (CIKOKOL/CILEUNGSI)' AS test_name,
    uc.id,
    uc.nama_lengkap,
    uc.email_sat,
    uc.cabang,
    uc.jabatan,
    COUNT(ubc.id) AS coverage_count
FROM user_cabang uc
LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(TRIM(uc.cabang)) IN ('CIKOKOL', 'CILEUNGSI')
GROUP BY uc.id, uc.nama_lengkap, uc.email_sat, uc.cabang, uc.jabatan
ORDER BY uc.cabang, uc.nama_lengkap;

-- ============================================================================
-- 3. Show coverage detail for CIKOKOL users
-- ============================================================================
SELECT 
    '3. Coverage detail for CIKOKOL users' AS test_name,
    uc.nama_lengkap,
    uc.email_sat,
    uc.cabang AS login_branch,
    uc.jabatan,
    ubc.covered_cabang,
    ubc.coverage_label
FROM user_cabang uc
LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(TRIM(uc.cabang)) = 'CIKOKOL'
ORDER BY uc.nama_lengkap, ubc.covered_cabang;

-- ============================================================================
-- 4. Show coverage detail for CILEUNGSI users
-- ============================================================================
SELECT 
    '4. Coverage detail for CILEUNGSI users' AS test_name,
    uc.nama_lengkap,
    uc.email_sat,
    uc.cabang AS login_branch,
    uc.jabatan,
    ubc.covered_cabang,
    ubc.coverage_label
FROM user_cabang uc
LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(TRIM(uc.cabang)) = 'CILEUNGSI'
ORDER BY uc.nama_lengkap, ubc.covered_cabang;

-- ============================================================================
-- 5. Find users WITHOUT coverage (will fallback to login branch)
-- ============================================================================
SELECT 
    '5. Users WITHOUT coverage (fallback to login branch)' AS test_name,
    uc.id,
    uc.nama_lengkap,
    uc.email_sat,
    uc.cabang AS login_branch_fallback,
    uc.jabatan
FROM user_cabang uc
WHERE NOT EXISTS (
    SELECT 1
    FROM user_branch_coverage ubc
    WHERE ubc.user_cabang_id = uc.id
)
AND UPPER(TRIM(uc.cabang)) IN ('CIKOKOL', 'CILEUNGSI')
ORDER BY uc.cabang, uc.nama_lengkap;

-- ============================================================================
-- 6. Check for Branch Support roles (should see all branches in group)
-- ============================================================================
SELECT 
    '6. Branch Support roles (should see all branches in group)' AS test_name,
    uc.id,
    uc.nama_lengkap,
    uc.email_sat,
    uc.cabang,
    uc.jabatan,
    COUNT(ubc.id) AS coverage_count
FROM user_cabang uc
LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE UPPER(TRIM(uc.jabatan)) LIKE '%BRANCH BUILDING SUPPORT%'
  AND UPPER(TRIM(uc.cabang)) IN ('CIKOKOL', 'CILEUNGSI')
GROUP BY uc.id, uc.nama_lengkap, uc.email_sat, uc.cabang, uc.jabatan
ORDER BY uc.cabang, uc.nama_lengkap;

-- ============================================================================
-- 7. Sample documents per cabang (for testing visibility)
-- ============================================================================
SELECT 
    '7. Sample RAB documents per cabang' AS test_name,
    t.cabang,
    COUNT(r.id) AS rab_count,
    STRING_AGG(DISTINCT r.status, ', ') AS statuses
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE UPPER(TRIM(t.cabang)) IN ('CIKOKOL', 'BALARAJA', 'PARUNG', 'SERANG', 
                                 'CILEUNGSI', 'BEKASI', 'KARAWANG', 'BOGOR')
GROUP BY t.cabang
ORDER BY t.cabang;

-- ============================================================================
-- 8. Test query: What should FIRMAN SOLEH see?
-- ============================================================================
-- Assuming FIRMAN SOLEH coverage: BALARAJA, SERANG
WITH firman_coverage AS (
    SELECT UNNEST(ARRAY['BALARAJA', 'SERANG']) AS allowed_branch
)
SELECT 
    '8. RAB documents FIRMAN SOLEH should see' AS test_name,
    r.id,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    r.status,
    r.created_at::date
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE UPPER(TRIM(t.cabang)) IN (SELECT allowed_branch FROM firman_coverage)
  AND r.status IN ('Menunggu Persetujuan Koordinator', 
                   'Menunggu Persetujuan Manajer', 
                   'Menunggu Persetujuan Direktur Kontraktor')
ORDER BY r.created_at DESC
LIMIT 10;

-- ============================================================================
-- 9. Test query: What should SUTRISNO see?
-- ============================================================================
-- Assuming SUTRISNO coverage: CIKOKOL, PARUNG
WITH sutrisno_coverage AS (
    SELECT UNNEST(ARRAY['CIKOKOL', 'PARUNG']) AS allowed_branch
)
SELECT 
    '9. RAB documents SUTRISNO should see' AS test_name,
    r.id,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    r.status,
    r.created_at::date
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE UPPER(TRIM(t.cabang)) IN (SELECT allowed_branch FROM sutrisno_coverage)
  AND r.status IN ('Menunggu Persetujuan Koordinator', 
                   'Menunggu Persetujuan Manajer', 
                   'Menunggu Persetujuan Direktur Kontraktor')
ORDER BY r.created_at DESC
LIMIT 10;

-- ============================================================================
-- 10. Test query: What should Support CIKOKOL see?
-- ============================================================================
-- Support should see all 4 branches: CIKOKOL, BALARAJA, PARUNG, SERANG
WITH support_cikokol_coverage AS (
    SELECT UNNEST(ARRAY['CIKOKOL', 'BALARAJA', 'PARUNG', 'SERANG']) AS allowed_branch
)
SELECT 
    '10. Documents Support CIKOKOL should see (all 4 branches)' AS test_name,
    t.cabang,
    COUNT(DISTINCT r.id) AS rab_count,
    COUNT(DISTINCT il.id) AS il_count,
    COUNT(DISTINCT ofn.id) AS ktk_count
FROM toko t
LEFT JOIN rab r ON r.id_toko = t.id
LEFT JOIN instruksi_lapangan il ON il.id_toko = t.id
LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
WHERE UPPER(TRIM(t.cabang)) IN (SELECT allowed_branch FROM support_cikokol_coverage)
GROUP BY t.cabang
ORDER BY t.cabang;

-- ============================================================================
-- 11. Verify no data leak: Documents that should NOT be visible
-- ============================================================================
-- FIRMAN (BALARAJA, SERANG) should NOT see CIKOKOL or PARUNG
SELECT 
    '11. Documents FIRMAN should NOT see (CIKOKOL, PARUNG)' AS test_name,
    t.cabang AS forbidden_branch,
    COUNT(r.id) AS rab_count_should_be_hidden
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE UPPER(TRIM(t.cabang)) IN ('CIKOKOL', 'PARUNG')
  AND r.status IN ('Menunggu Persetujuan Koordinator', 
                   'Menunggu Persetujuan Manajer', 
                   'Menunggu Persetujuan Direktur Kontraktor')
GROUP BY t.cabang;

-- ============================================================================
-- 12. Check auth_session table for active sessions
-- ============================================================================
SELECT 
    '12. Active auth sessions' AS test_name,
    email_sat,
    cabang,
    jabatan,
    roles,
    expires_at,
    created_at::date AS session_created
FROM auth_session
WHERE expires_at > now()
ORDER BY created_at DESC
LIMIT 20;
