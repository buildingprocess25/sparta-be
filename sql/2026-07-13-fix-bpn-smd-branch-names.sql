-- Fix SIDOARJO BPN SMD branch name inconsistencies
-- Date: 2026-07-13
-- Issue: 403 Forbidden on approval RAB for ULOK UZ01-2606-0006
-- Root Cause: Branch name stored with underscore or other variants instead of space

-- ============================================================================
-- STEP 1: INVESTIGATION - Check current state
-- ============================================================================

-- 1.1 Check specific ULOK UZ01-2606-0006
SELECT 
    '1.1 ULOK UZ01-2606-0006 current state' AS step,
    t.id,
    t.nomor_ulok,
    t.cabang,
    LENGTH(t.cabang) as cabang_length,
    t.nama_toko,
    r.id as rab_id,
    r.nomor_rab,
    r.status as rab_status
FROM toko t
LEFT JOIN rab r ON r.toko_id = t.id
WHERE t.nomor_ulok = 'UZ01-2606-0006'
ORDER BY r.created_at DESC
LIMIT 1;

-- 1.2 Find all BPN SMD variants in toko table
SELECT 
    '1.2 All BPN SMD variants in toko' AS step,
    cabang,
    LENGTH(cabang) as len,
    COUNT(*) as count,
    CASE 
        WHEN cabang = 'SIDOARJO BPN SMD' THEN '✅ Correct'
        ELSE '⚠️ Needs fix'
    END as status
FROM toko
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
GROUP BY cabang
ORDER BY cabang;

-- 1.3 Find all BPN SMD variants in user_cabang table
SELECT 
    '1.3 All BPN SMD variants in user_cabang' AS step,
    cabang,
    LENGTH(cabang) as len,
    COUNT(*) as count,
    CASE 
        WHEN cabang = 'SIDOARJO BPN SMD' THEN '✅ Correct'
        ELSE '⚠️ Needs fix'
    END as status
FROM user_cabang
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
GROUP BY cabang
ORDER BY cabang;

-- 1.4 Check SIDOARJO coordinator users
SELECT 
    '1.4 SIDOARJO coordinator users' AS step,
    email_sat,
    nama_lengkap,
    cabang,
    jabatan
FROM user_cabang
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(jabatan) LIKE '%KOORDINATOR%' OR 'KOORDINATOR' = ANY(roles))
ORDER BY cabang, nama_lengkap;

-- ============================================================================
-- STEP 2: BACKUP (Optional but recommended)
-- ============================================================================

-- Create backup tables (uncomment to use)
/*
CREATE TABLE toko_backup_20260713 AS
SELECT * FROM toko
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%');

CREATE TABLE user_cabang_backup_20260713 AS
SELECT * FROM user_cabang
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%');

SELECT 'Backup created' AS message;
*/

-- ============================================================================
-- STEP 3: FIX - Update to canonical "SIDOARJO BPN SMD"
-- ============================================================================

-- 3.1 Preview affected records in toko
SELECT 
    '3.1 PREVIEW: toko records to update' AS step,
    id,
    nomor_ulok,
    cabang as old_cabang,
    'SIDOARJO BPN SMD' as new_cabang,
    nama_toko
FROM toko
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
  AND cabang != 'SIDOARJO BPN SMD'
ORDER BY nomor_ulok
LIMIT 20;

-- 3.2 Preview affected records in user_cabang
SELECT 
    '3.2 PREVIEW: user_cabang records to update' AS step,
    id,
    email_sat,
    nama_lengkap,
    cabang as old_cabang,
    'SIDOARJO BPN SMD' as new_cabang,
    jabatan
FROM user_cabang
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
  AND cabang != 'SIDOARJO BPN SMD'
ORDER BY nama_lengkap;

-- 3.3 Execute update on toko table (UNCOMMENT TO RUN)
/*
UPDATE toko
SET cabang = 'SIDOARJO BPN SMD',
    updated_at = now()
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
  AND cabang != 'SIDOARJO BPN SMD';

SELECT 'toko table updated: ' || COUNT(*) || ' records' AS result
FROM toko
WHERE cabang = 'SIDOARJO BPN SMD';
*/

-- 3.4 Execute update on user_cabang table (UNCOMMENT TO RUN)
/*
UPDATE user_cabang
SET cabang = 'SIDOARJO BPN SMD',
    updated_at = now()
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
  AND cabang != 'SIDOARJO BPN SMD';

SELECT 'user_cabang table updated: ' || COUNT(*) || ' records' AS result
FROM user_cabang
WHERE cabang = 'SIDOARJO BPN SMD';
*/

-- ============================================================================
-- STEP 4: VERIFICATION - Check after fix
-- ============================================================================

-- 4.1 Verify UZ01-2606-0006
SELECT 
    '4.1 VERIFY: UZ01-2606-0006 after fix' AS step,
    t.nomor_ulok,
    t.cabang,
    CASE 
        WHEN t.cabang = 'SIDOARJO BPN SMD' THEN '✅ Fixed'
        ELSE '❌ Still wrong: ' || t.cabang
    END as status,
    t.nama_toko
FROM toko t
WHERE t.nomor_ulok = 'UZ01-2606-0006';

-- 4.2 Verify all toko records
SELECT 
    '4.2 VERIFY: All BPN SMD in toko after fix' AS step,
    cabang,
    COUNT(*) as count,
    CASE 
        WHEN cabang = 'SIDOARJO BPN SMD' THEN '✅ Correct'
        ELSE '❌ Still wrong'
    END as status
FROM toko
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%' OR UPPER(cabang) LIKE '%SMD%')
GROUP BY cabang
ORDER BY cabang;

-- 4.3 Verify all user_cabang records
SELECT 
    '4.3 VERIFY: All BPN SMD in user_cabang after fix' AS step,
    cabang,
    COUNT(*) as count,
    CASE 
        WHEN cabang = 'SIDOARJO BPN SMD' THEN '✅ Correct'
        ELSE '❌ Still wrong'
    END as status
FROM user_cabang
WHERE UPPER(cabang) LIKE '%SIDOARJO%'
  AND (UPPER(cabang) LIKE '%BPN%' OR UPPER(cabang) LIKE '%SMD%')
GROUP BY cabang
ORDER BY cabang;

-- 4.4 Check related documents
SELECT 
    '4.4 VERIFY: Related documents for BPN SMD' AS step,
    'RAB' as doc_type,
    COUNT(*) as count
FROM toko t
JOIN rab r ON r.toko_id = t.id
WHERE t.cabang = 'SIDOARJO BPN SMD'
UNION ALL
SELECT 
    '4.4 VERIFY: Related documents for BPN SMD' AS step,
    'SPK' as doc_type,
    COUNT(*) as count
FROM toko t
JOIN spk s ON s.id_toko = t.id
WHERE t.cabang = 'SIDOARJO BPN SMD'
UNION ALL
SELECT 
    '4.4 VERIFY: Related documents for BPN SMD' AS step,
    'Gantt' as doc_type,
    COUNT(*) as count
FROM toko t
JOIN gantt_chart g ON g.id_toko = t.id
WHERE t.cabang = 'SIDOARJO BPN SMD';

-- ============================================================================
-- STEP 5: ROLLBACK (If needed - use only if fix causes problems)
-- ============================================================================

-- Rollback from backup (uncomment if needed)
/*
UPDATE toko t
SET cabang = b.cabang,
    updated_at = now()
FROM toko_backup_20260713 b
WHERE t.id = b.id;

UPDATE user_cabang uc
SET cabang = b.cabang,
    updated_at = now()
FROM user_cabang_backup_20260713 b
WHERE uc.id = b.id;

SELECT 'Rollback completed' AS message;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

-- Expected results after fix:
-- 1. UZ01-2606-0006 should have cabang = "SIDOARJO BPN SMD"
-- 2. All toko with BPN SMD should have exact same format
-- 3. All user_cabang with BPN SMD should have exact same format
-- 4. SIDOARJO coordinator should be able to approve RAB without 403 error

-- Next steps after running this SQL:
-- 1. Restart backend application to clear any caches
-- 2. Test login as SIDOARJO coordinator
-- 3. Test approval of RAB for UZ01-2606-0006
-- 4. Verify document listing shows BPN SMD documents

-- Related files to update in codebase:
-- ✅ sparta-be/src/modules/spk/spk.constants.ts - Updated to use space
-- ✅ sparta-be/src/modules/price-rab/price-rab.constants.ts - Updated to use space
-- ✅ sparta-be/src/common/branch-scope.ts - Already correct with space
-- ✅ sparta-fe/lib/constants.ts - Already correct with space
