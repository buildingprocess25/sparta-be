-- =====================================================================
-- IMPACT ANALYSIS: National Holidays 2026
-- =====================================================================
-- Purpose: Analyze dampak libur nasional terhadap perhitungan denda
-- Date: 2026-07-13
-- =====================================================================

-- Function helper untuk check national holiday
CREATE OR REPLACE FUNCTION is_national_holiday_2026(check_date DATE) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN check_date IN (
        '2026-01-01'::date,  -- Tahun Baru
        '2026-01-16'::date,  -- Isra Mikraj
        '2026-02-17'::date,  -- Imlek
        '2026-03-19'::date,  -- Nyepi
        '2026-04-03'::date,  -- Wafat Yesus
        '2026-05-01'::date,  -- Hari Buruh
        '2026-05-14'::date,  -- Kenaikan Yesus
        '2026-05-27'::date,  -- Iduladha
        '2026-06-01'::date,  -- Hari Lahir Pancasila
        '2026-06-16'::date,  -- Tahun Baru Islam
        '2026-08-17'::date,  -- Proklamasi RI
        '2026-08-25'::date,  -- Maulid Nabi
        '2026-12-25'::date   -- Natal
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function helper untuk next business day (skip weekend + holiday)
CREATE OR REPLACE FUNCTION next_business_day_2026(start_date DATE) 
RETURNS DATE AS $$
DECLARE
    current_date DATE := start_date + INTERVAL '1 day';
    day_of_week INT;
BEGIN
    LOOP
        day_of_week := EXTRACT(DOW FROM current_date);
        
        -- Check if weekend (0=Sunday, 6=Saturday) OR holiday
        IF day_of_week NOT IN (0, 6) AND NOT is_national_holiday_2026(current_date) THEN
            RETURN current_date;
        END IF;
        
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================================
-- MAIN ANALYSIS QUERY
-- =====================================================================

WITH spk_data AS (
    -- Get all SPK 2026 with extension
    SELECT 
        ps.id AS id_spk,
        ps.id_toko,
        ps.nomor_ulok,
        ps.lingkup_pekerjaan,
        t.nama_toko,
        t.cabang,
        ps.waktu_mulai,
        ps.waktu_selesai,
        ps.durasi,
        COALESCE(
            MAX(pt.tanggal_spk_akhir_setelah_perpanjangan) FILTER (
                WHERE UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
            ),
            ps.waktu_selesai
        ) AS spk_end_date
    FROM pengajuan_spk ps
    JOIN toko t ON t.id = ps.id_toko
    LEFT JOIN pertambahan_spk pt ON pt.id_spk = ps.id
    WHERE UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
      AND ps.waktu_selesai >= '2026-01-01'::date
      AND ps.waktu_selesai < '2027-01-01'::date
    GROUP BY ps.id, ps.id_toko, ps.nomor_ulok, ps.lingkup_pekerjaan, 
             t.nama_toko, t.cabang, ps.waktu_mulai, ps.waktu_selesai, ps.durasi
),
st_data AS (
    -- Get ST data
    SELECT 
        bst.id_toko,
        bst.created_at::date AS st_date
    FROM berkas_serah_terima bst
),
opname_data AS (
    -- Get current denda from opname_final
    SELECT 
        ofn.id_toko,
        ofn.hari_denda AS old_denda_days,
        ofn.nilai_denda AS old_denda_amount
    FROM opname_final ofn
),
grace_calculation AS (
    -- Calculate old vs new grace period
    SELECT 
        s.*,
        st.st_date,
        ofn.old_denda_days,
        ofn.old_denda_amount,
        
        -- Old grace (hanya skip weekend)
        CASE 
            WHEN EXTRACT(DOW FROM s.spk_end_date) = 5 THEN s.spk_end_date + INTERVAL '3 days'  -- Jumat -> Senin
            WHEN EXTRACT(DOW FROM s.spk_end_date) = 6 THEN s.spk_end_date + INTERVAL '2 days'  -- Sabtu -> Senin
            ELSE s.spk_end_date + INTERVAL '1 day'
        END::date AS old_grace_date,
        
        -- New grace (skip weekend + holiday)
        next_business_day_2026(s.spk_end_date) AS new_grace_date
        
    FROM spk_data s
    LEFT JOIN st_data st ON st.id_toko = s.id_toko
    LEFT JOIN opname_data ofn ON ofn.id_toko = s.id_toko
),
impact_calculation AS (
    SELECT 
        *,
        -- Calculate skipped days
        (new_grace_date - old_grace_date) AS days_difference,
        
        -- Old denda calculation (from database)
        COALESCE(old_denda_days, 0) AS old_denda_days_calc,
        COALESCE(old_denda_amount::numeric, 0) AS old_denda_amount_calc,
        
        -- New denda calculation
        CASE 
            WHEN st_date IS NULL THEN 0
            WHEN st_date <= new_grace_date THEN 0
            ELSE (st_date - new_grace_date)::int
        END AS new_denda_days_calc,
        
        CASE 
            WHEN st_date IS NULL THEN 0
            WHEN st_date <= new_grace_date THEN 0
            ELSE 
                CASE 
                    WHEN (st_date - new_grace_date)::int <= 5 THEN (st_date - new_grace_date)::int * 1000000
                    WHEN (st_date - new_grace_date)::int <= 10 THEN 5000000 + ((st_date - new_grace_date)::int - 5) * 500000
                    ELSE 7500000
                END
        END AS new_denda_amount_calc
        
    FROM grace_calculation
)
SELECT 
    nomor_ulok,
    nama_toko,
    cabang,
    lingkup_pekerjaan,
    spk_end_date,
    st_date,
    CASE WHEN st_date IS NOT NULL THEN 'Sudah ST' ELSE 'Belum ST' END AS st_status,
    
    -- Grace period
    old_grace_date,
    new_grace_date,
    days_difference AS grace_shift_days,
    
    -- Denda comparison
    old_denda_days_calc AS old_denda_days,
    old_denda_amount_calc AS old_denda_amount,
    new_denda_days_calc AS new_denda_days,
    new_denda_amount_calc AS new_denda_amount,
    
    -- Impact
    (new_denda_days_calc - old_denda_days_calc) AS impact_days,
    (new_denda_amount_calc - old_denda_amount_calc) AS impact_amount,
    
    CASE 
        WHEN (new_denda_amount_calc - old_denda_amount_calc) < 0 THEN 'REDUCTION'
        WHEN (new_denda_amount_calc - old_denda_amount_calc) > 0 THEN 'INCREASE'
        ELSE 'NO_CHANGE'
    END AS impact_type,
    
    -- Check if affected by holiday
    CASE 
        WHEN days_difference > 0 THEN 'YES'
        ELSE 'NO'
    END AS affected_by_holiday

FROM impact_calculation
WHERE 1=1
  -- Filter: only show records with impact or affected by holiday
  AND (
      (new_denda_amount_calc - old_denda_amount_calc) != 0
      OR days_difference > 0
  )
ORDER BY 
    impact_amount ASC,  -- Biggest savings first
    nomor_ulok ASC;

-- =====================================================================
-- SUMMARY STATISTICS
-- =====================================================================

\echo ''
\echo '============================================================'
\echo 'SUMMARY STATISTICS'
\echo '============================================================'

WITH spk_data AS (
    SELECT 
        ps.id AS id_spk,
        ps.id_toko,
        ps.nomor_ulok,
        ps.waktu_selesai,
        t.cabang,
        COALESCE(
            MAX(pt.tanggal_spk_akhir_setelah_perpanjangan) FILTER (
                WHERE UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
            ),
            ps.waktu_selesai
        ) AS spk_end_date
    FROM pengajuan_spk ps
    JOIN toko t ON t.id = ps.id_toko
    LEFT JOIN pertambahan_spk pt ON pt.id_spk = ps.id
    WHERE UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
      AND ps.waktu_selesai >= '2026-01-01'::date
      AND ps.waktu_selesai < '2027-01-01'::date
    GROUP BY ps.id, ps.id_toko, ps.nomor_ulok, ps.waktu_selesai, t.cabang
),
st_data AS (
    SELECT 
        bst.id_toko,
        bst.created_at::date AS st_date
    FROM berkas_serah_terima bst
),
opname_data AS (
    SELECT 
        ofn.id_toko,
        ofn.hari_denda AS old_denda_days,
        ofn.nilai_denda AS old_denda_amount
    FROM opname_final ofn
),
grace_calculation AS (
    SELECT 
        s.*,
        st.st_date,
        ofn.old_denda_days,
        ofn.old_denda_amount,
        CASE 
            WHEN EXTRACT(DOW FROM s.spk_end_date) = 5 THEN s.spk_end_date + INTERVAL '3 days'
            WHEN EXTRACT(DOW FROM s.spk_end_date) = 6 THEN s.spk_end_date + INTERVAL '2 days'
            ELSE s.spk_end_date + INTERVAL '1 day'
        END::date AS old_grace_date,
        next_business_day_2026(s.spk_end_date) AS new_grace_date
    FROM spk_data s
    LEFT JOIN st_data st ON st.id_toko = s.id_toko
    LEFT JOIN opname_data ofn ON ofn.id_toko = s.id_toko
),
impact_calculation AS (
    SELECT 
        *,
        (new_grace_date - old_grace_date) AS days_difference,
        COALESCE(old_denda_days, 0) AS old_denda_days_calc,
        COALESCE(old_denda_amount::numeric, 0) AS old_denda_amount_calc,
        CASE 
            WHEN st_date IS NULL THEN 0
            WHEN st_date <= new_grace_date THEN 0
            ELSE (st_date - new_grace_date)::int
        END AS new_denda_days_calc,
        CASE 
            WHEN st_date IS NULL THEN 0
            WHEN st_date <= new_grace_date THEN 0
            ELSE 
                CASE 
                    WHEN (st_date - new_grace_date)::int <= 5 THEN (st_date - new_grace_date)::int * 1000000
                    WHEN (st_date - new_grace_date)::int <= 10 THEN 5000000 + ((st_date - new_grace_date)::int - 5) * 500000
                    ELSE 7500000
                END
        END AS new_denda_amount_calc
    FROM grace_calculation
)
SELECT 
    'Total SPK 2026' AS metric,
    COUNT(*)::text AS value
FROM spk_data

UNION ALL

SELECT 
    'Sudah ST' AS metric,
    COUNT(*)::text AS value
FROM impact_calculation
WHERE st_date IS NOT NULL

UNION ALL

SELECT 
    'Belum ST' AS metric,
    COUNT(*)::text AS value
FROM impact_calculation
WHERE st_date IS NULL

UNION ALL

SELECT 
    'Affected by Holiday' AS metric,
    COUNT(*)::text AS value
FROM impact_calculation
WHERE days_difference > 0

UNION ALL

SELECT 
    'REDUCTION (denda ↓)' AS metric,
    COUNT(*)::text AS value
FROM impact_calculation
WHERE (new_denda_amount_calc - old_denda_amount_calc) < 0

UNION ALL

SELECT 
    'NO CHANGE (denda =)' AS metric,
    COUNT(*)::text AS value
FROM impact_calculation
WHERE (new_denda_amount_calc - old_denda_amount_calc) = 0

UNION ALL

SELECT 
    'INCREASE (denda ↑)' AS metric,
    COUNT(*)::text AS value
FROM impact_calculation
WHERE (new_denda_amount_calc - old_denda_amount_calc) > 0

UNION ALL

SELECT 
    'Old Total Denda' AS metric,
    'Rp ' || TO_CHAR(SUM(old_denda_amount_calc), 'FM999,999,999,999') AS value
FROM impact_calculation

UNION ALL

SELECT 
    'New Total Denda' AS metric,
    'Rp ' || TO_CHAR(SUM(new_denda_amount_calc), 'FM999,999,999,999') AS value
FROM impact_calculation

UNION ALL

SELECT 
    'Total Impact' AS metric,
    'Rp ' || TO_CHAR(SUM(new_denda_amount_calc - old_denda_amount_calc), 'FM999,999,999,999') AS value
FROM impact_calculation;

-- =====================================================================
-- CLEANUP
-- =====================================================================

-- DROP FUNCTION is_national_holiday_2026(DATE);
-- DROP FUNCTION next_business_day_2026(DATE);
