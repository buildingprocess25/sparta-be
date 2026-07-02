-- Seed example user branch coverage for testing restrukturisasi
-- DO NOT RUN IN PRODUCTION without verifying users exist

-- Example: FIRMAN SOLEH
-- Login: CIKOKOL (cabang induk)
-- Coverage: BALARAJA, SERANG (cabang anak)
-- Expected behavior: Hanya lihat dokumen BALARAJA/SERANG, tidak bisa lihat CIKOKOL/PARUNG

DO $$
DECLARE
    v_firman_id INTEGER;
BEGIN
    -- Find FIRMAN SOLEH user_cabang_id
    SELECT id INTO v_firman_id
    FROM user_cabang
    WHERE LOWER(TRIM(nama_lengkap)) LIKE '%firman%soleh%'
      AND UPPER(TRIM(cabang)) = 'CIKOKOL'
    LIMIT 1;

    IF v_firman_id IS NOT NULL THEN
        -- Delete existing coverage
        DELETE FROM user_branch_coverage WHERE user_cabang_id = v_firman_id;

        -- Insert coverage: BALARAJA, SERANG only
        INSERT INTO user_branch_coverage (user_cabang_id, covered_cabang, coverage_label)
        VALUES
            (v_firman_id, 'BALARAJA', 'Wilayah Tangsel Barat'),
            (v_firman_id, 'SERANG', 'Wilayah Banten')
        ON CONFLICT (user_cabang_id, covered_cabang) DO NOTHING;

        RAISE NOTICE 'FIRMAN SOLEH coverage: BALARAJA, SERANG';
    ELSE
        RAISE NOTICE 'FIRMAN SOLEH tidak ditemukan di user_cabang dengan cabang CIKOKOL';
    END IF;
END $$;

-- Example: SUTRISNO
-- Login: CIKOKOL (cabang induk)
-- Coverage: CIKOKOL, PARUNG (cabang anak)
-- Expected behavior: Hanya lihat dokumen CIKOKOL/PARUNG, tidak bisa lihat BALARAJA/SERANG

DO $$
DECLARE
    v_sutrisno_id INTEGER;
BEGIN
    -- Find SUTRISNO user_cabang_id
    SELECT id INTO v_sutrisno_id
    FROM user_cabang
    WHERE LOWER(TRIM(nama_lengkap)) LIKE '%sutrisno%'
      AND UPPER(TRIM(cabang)) = 'CIKOKOL'
    LIMIT 1;

    IF v_sutrisno_id IS NOT NULL THEN
        -- Delete existing coverage
        DELETE FROM user_branch_coverage WHERE user_cabang_id = v_sutrisno_id;

        -- Insert coverage: CIKOKOL, PARUNG only
        INSERT INTO user_branch_coverage (user_cabang_id, covered_cabang, coverage_label)
        VALUES
            (v_sutrisno_id, 'CIKOKOL', 'Wilayah Tangerang Pusat'),
            (v_sutrisno_id, 'PARUNG', 'Wilayah Bogor Selatan')
        ON CONFLICT (user_cabang_id, covered_cabang) DO NOTHING;

        RAISE NOTICE 'SUTRISNO coverage: CIKOKOL, PARUNG';
    ELSE
        RAISE NOTICE 'SUTRISNO tidak ditemukan di user_cabang dengan cabang CIKOKOL';
    END IF;
END $$;

-- Verify seeding
SELECT 
    uc.nama_lengkap,
    uc.email_sat,
    uc.cabang AS cabang_login,
    uc.jabatan,
    ubc.covered_cabang,
    ubc.coverage_label
FROM user_cabang uc
JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE (
    LOWER(TRIM(uc.nama_lengkap)) LIKE '%firman%soleh%'
    OR LOWER(TRIM(uc.nama_lengkap)) LIKE '%sutrisno%'
)
AND UPPER(TRIM(uc.cabang)) = 'CIKOKOL'
ORDER BY uc.nama_lengkap, ubc.covered_cabang;

-- Query to check if data is correct
SELECT 
    'FIRMAN SOLEH should see BALARAJA, SERANG' AS test_case,
    COUNT(*) AS coverage_count,
    STRING_AGG(ubc.covered_cabang, ', ' ORDER BY ubc.covered_cabang) AS branches
FROM user_cabang uc
JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE LOWER(TRIM(uc.nama_lengkap)) LIKE '%firman%soleh%'
  AND UPPER(TRIM(uc.cabang)) = 'CIKOKOL'

UNION ALL

SELECT 
    'SUTRISNO should see CIKOKOL, PARUNG' AS test_case,
    COUNT(*) AS coverage_count,
    STRING_AGG(ubc.covered_cabang, ', ' ORDER BY ubc.covered_cabang) AS branches
FROM user_cabang uc
JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
WHERE LOWER(TRIM(uc.nama_lengkap)) LIKE '%sutrisno%'
  AND UPPER(TRIM(uc.cabang)) = 'CIKOKOL';
