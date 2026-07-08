-- ============================================================
-- Migration: Fix Cepoko Serah Terima Date Bug
-- Date: 2026-07-08
-- Description: 
--   Bug: Serah Terima tercatat tanggal 30 Juni, padahal kontraktor
--   submit Opname tanggal 29 Juni. Background job auto-generate
--   Serah Terima melewati tengah malam, sehingga created_at
--   menggunakan timestamp 30 Juni instead of 29 Juni.
--
--   Fix: Sync berkas_serah_terima.created_at dengan opname_final.created_at
--   dan recalculate denda menjadi 0.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Diagnostic - Show Current State
-- ============================================================

DO $$
DECLARE
    v_toko_count INTEGER;
    v_opname_date DATE;
    v_st_date DATE;
    v_current_denda INTEGER;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC: Current State for Cepoko ===';
    
    SELECT COUNT(*)
    INTO v_toko_count
    FROM toko
    WHERE UPPER(nama_toko) LIKE '%CEPOKO%BARU%'
       OR UPPER(nomor_ulok) LIKE '%CEPOKO%';
    
    IF v_toko_count = 0 THEN
        RAISE EXCEPTION 'Toko Cepoko tidak ditemukan! Pastikan nama/ULOK benar.';
    END IF;
    
    RAISE NOTICE 'Found % toko(s) matching Cepoko', v_toko_count;
    
    -- Show details
    FOR v_opname_date, v_st_date, v_current_denda IN
        SELECT 
            DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS opname_date,
            DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date,
            ofn.hari_denda
        FROM toko t
        LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
           OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%'
    LOOP
        RAISE NOTICE 'Opname Date: %, ST Date: %, Current Denda: % hari', 
            v_opname_date, v_st_date, v_current_denda;
    END LOOP;
END $$;

-- ============================================================
-- STEP 2: Show Detailed Data Before Fix
-- ============================================================

SELECT 
    t.id AS toko_id,
    t.nomor_ulok,
    t.nama_toko,
    t.lingkup_pekerjaan,
    t.cabang,
    
    -- SPK Info
    ps.waktu_selesai AS spk_end_date,
    
    -- Gantt Info
    MAX(NULLIF(regexp_replace(dgc.h_akhir, '[^0-9]', '', 'g'), '')::int) AS gantt_last_day,
    
    -- Opname Final
    ofn.id AS opname_final_id,
    ofn.created_at AS opname_created_at_full,
    DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS opname_date,
    TO_CHAR(ofn.created_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS opname_time,
    
    -- Serah Terima
    bst.id AS berkas_st_id,
    bst.created_at AS st_created_at_full,
    DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date,
    TO_CHAR(bst.created_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS st_time,
    
    -- Denda
    ofn.hari_denda AS current_hari_denda,
    ofn.nilai_denda AS current_nilai_denda,
    ofn.tanggal_akhir_spk_denda,
    ofn.tanggal_serah_terima_denda,
    
    -- Issue Detection
    CASE 
        WHEN DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') > DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
        THEN '❌ BUG: ST later than Opname'
        WHEN DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') = DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
        THEN '✅ OK: ST same date as Opname'
        ELSE 'ℹ️ Other'
    END AS status
    
FROM toko t
LEFT JOIN pengajuan_spk ps ON ps.id_toko = t.id
LEFT JOIN gantt_chart gc ON gc.id_toko = t.id
LEFT JOIN day_gantt_chart dgc ON dgc.id_gantt = gc.id
LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id

WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
   OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%'

GROUP BY 
    t.id, t.nomor_ulok, t.nama_toko, t.lingkup_pekerjaan, t.cabang,
    ps.waktu_selesai,
    ofn.id, ofn.created_at, ofn.hari_denda, ofn.nilai_denda,
    ofn.tanggal_akhir_spk_denda, ofn.tanggal_serah_terima_denda,
    bst.id, bst.created_at;

-- ============================================================
-- STEP 3: Create Audit Table (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS serah_terima_date_fix_audit (
    id SERIAL PRIMARY KEY,
    toko_id INTEGER NOT NULL,
    nomor_ulok TEXT,
    nama_toko TEXT,
    lingkup_pekerjaan TEXT,
    
    -- Old values
    old_st_created_at TIMESTAMP,
    old_opname_created_at TIMESTAMP,
    old_hari_denda INTEGER,
    old_nilai_denda NUMERIC,
    old_tanggal_serah_terima_denda DATE,
    
    -- New values
    new_st_created_at TIMESTAMP,
    new_hari_denda INTEGER,
    new_nilai_denda NUMERIC,
    new_tanggal_serah_terima_denda DATE,
    
    -- Metadata
    fix_reason TEXT,
    fixed_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    fixed_by TEXT DEFAULT 'SYSTEM_ADMIN'
);

-- ============================================================
-- STEP 4: Backup Data to Audit Table
-- ============================================================

INSERT INTO serah_terima_date_fix_audit (
    toko_id,
    nomor_ulok,
    nama_toko,
    lingkup_pekerjaan,
    old_st_created_at,
    old_opname_created_at,
    old_hari_denda,
    old_nilai_denda,
    old_tanggal_serah_terima_denda,
    new_st_created_at,
    new_hari_denda,
    new_nilai_denda,
    new_tanggal_serah_terima_denda,
    fix_reason
)
SELECT 
    t.id,
    t.nomor_ulok,
    t.nama_toko,
    t.lingkup_pekerjaan,
    bst.created_at AS old_st_created_at,
    ofn.created_at AS old_opname_created_at,
    ofn.hari_denda AS old_hari_denda,
    ofn.nilai_denda AS old_nilai_denda,
    ofn.tanggal_serah_terima_denda AS old_tanggal_serah_terima_denda,
    ofn.created_at AS new_st_created_at,
    0 AS new_hari_denda,
    0 AS new_nilai_denda,
    DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS new_tanggal_serah_terima_denda,
    'Bug: Background job auto-generate ST melewati tengah malam. ST tercatat 30 Juni instead of 29 Juni (tanggal Opname).' AS fix_reason
FROM toko t
JOIN opname_final ofn ON ofn.id_toko = t.id
JOIN berkas_serah_terima bst ON bst.id_toko = t.id
WHERE (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
  AND DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') > DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta');

-- ============================================================
-- STEP 5: Fix berkas_serah_terima.created_at
-- ============================================================

DO $$
DECLARE
    v_affected_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== STEP 5: Fixing berkas_serah_terima.created_at ===';
    
    WITH updated AS (
        UPDATE berkas_serah_terima bst
        SET created_at = ofn.created_at
        FROM toko t
        JOIN opname_final ofn ON ofn.id_toko = t.id
        WHERE bst.id_toko = t.id
          AND (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
          AND DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') > DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
        RETURNING bst.id
    )
    SELECT COUNT(*) INTO v_affected_count FROM updated;
    
    RAISE NOTICE 'Updated % berkas_serah_terima record(s)', v_affected_count;
    
    IF v_affected_count = 0 THEN
        RAISE NOTICE 'No records to fix - ST dates already match Opname dates';
    END IF;
END $$;

-- ============================================================
-- STEP 6: Recalculate Denda in opname_final
-- ============================================================

DO $$
DECLARE
    v_affected_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== STEP 6: Recalculating Denda ===';
    
    WITH updated AS (
        UPDATE opname_final ofn
        SET 
            hari_denda = 0,
            nilai_denda = 0,
            tanggal_serah_terima_denda = DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
        FROM toko t
        WHERE ofn.id_toko = t.id
          AND (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
          AND ofn.hari_denda > 0
        RETURNING ofn.id
    )
    SELECT COUNT(*) INTO v_affected_count FROM updated;
    
    RAISE NOTICE 'Updated denda for % opname_final record(s)', v_affected_count;
END $$;

-- ============================================================
-- STEP 7: Verify Fix - Show After State
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== STEP 7: Verification - After Fix ===';
END $$;

SELECT 
    t.id AS toko_id,
    t.nomor_ulok,
    t.nama_toko,
    t.lingkup_pekerjaan,
    
    -- Opname Final
    ofn.id AS opname_final_id,
    DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS opname_date,
    TO_CHAR(ofn.created_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS opname_time,
    
    -- Serah Terima (AFTER FIX)
    bst.id AS berkas_st_id,
    DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date_after_fix,
    TO_CHAR(bst.created_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS st_time_after_fix,
    
    -- Denda (AFTER FIX)
    ofn.hari_denda AS hari_denda_after_fix,
    ofn.nilai_denda AS nilai_denda_after_fix,
    ofn.tanggal_serah_terima_denda AS tanggal_st_denda_after_fix,
    
    -- Verification
    CASE 
        WHEN DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') = DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
             AND ofn.hari_denda = 0
        THEN '✅ FIXED: ST synced with Opname, denda = 0'
        WHEN DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') = DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
             AND ofn.hari_denda > 0
        THEN '⚠️ WARNING: ST synced but denda still > 0'
        ELSE '❌ FAILED: ST not synced'
    END AS verification_status
    
FROM toko t
LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id

WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
   OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%';

-- ============================================================
-- STEP 8: Show Audit Log
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== STEP 8: Audit Log ===';
END $$;

SELECT 
    id,
    nomor_ulok,
    nama_toko,
    lingkup_pekerjaan,
    
    -- Changes
    DATE(old_st_created_at AT TIME ZONE 'Asia/Jakarta') AS old_st_date,
    DATE(new_st_created_at AT TIME ZONE 'Asia/Jakarta') AS new_st_date,
    old_hari_denda || ' hari → ' || new_hari_denda || ' hari' AS denda_change,
    'Rp ' || old_nilai_denda || ' → Rp ' || new_nilai_denda AS nilai_change,
    
    -- Metadata
    fix_reason,
    fixed_at,
    fixed_by
    
FROM serah_terima_date_fix_audit
WHERE fixed_at >= timezone('Asia/Jakarta', now()) - INTERVAL '5 minutes'
ORDER BY fixed_at DESC;

-- ============================================================
-- STEP 9: Summary Report
-- ============================================================

DO $$
DECLARE
    v_total_fixed INTEGER;
    v_total_denda_cleared INTEGER;
    v_total_nilai_cleared NUMERIC;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== STEP 9: Summary Report ===';
    
    SELECT 
        COUNT(*),
        SUM(old_hari_denda - new_hari_denda),
        SUM(old_nilai_denda - new_nilai_denda)
    INTO 
        v_total_fixed,
        v_total_denda_cleared,
        v_total_nilai_cleared
    FROM serah_terima_date_fix_audit
    WHERE fixed_at >= timezone('Asia/Jakarta', now()) - INTERVAL '5 minutes';
    
    RAISE NOTICE 'Total records fixed: %', COALESCE(v_total_fixed, 0);
    RAISE NOTICE 'Total denda hari cleared: % hari', COALESCE(v_total_denda_cleared, 0);
    RAISE NOTICE 'Total nilai denda cleared: Rp %', COALESCE(v_total_nilai_cleared, 0);
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration completed successfully!';
END $$;

-- ============================================================
-- COMMIT or ROLLBACK
-- ============================================================

-- ROLLBACK; -- Uncomment untuk test mode (tidak apply changes)
COMMIT; -- Comment untuk test mode

-- ============================================================
-- NOTES:
-- 
-- 1. Test Mode:
--    - Comment out COMMIT
--    - Uncomment ROLLBACK
--    - Run script to see what would change without applying
--
-- 2. Production Mode:
--    - Uncomment COMMIT
--    - Comment out ROLLBACK (if uncommented)
--    - Run script to apply changes
--
-- 3. Verification:
--    - Check verification_status = '✅ FIXED'
--    - Check hari_denda = 0
--    - Check st_date = opname_date
--
-- 4. Rollback (if needed):
--    You can restore from audit table:
--    
--    UPDATE berkas_serah_terima bst
--    SET created_at = audit.old_st_created_at
--    FROM serah_terima_date_fix_audit audit
--    WHERE bst.id_toko = audit.toko_id
--      AND audit.id = <specific_audit_id>;
--
--    UPDATE opname_final ofn
--    SET hari_denda = audit.old_hari_denda,
--        nilai_denda = audit.old_nilai_denda,
--        tanggal_serah_terima_denda = audit.old_tanggal_serah_terima_denda
--    FROM serah_terima_date_fix_audit audit
--    WHERE ofn.id_toko = audit.toko_id
--      AND audit.id = <specific_audit_id>;
--
-- ============================================================
