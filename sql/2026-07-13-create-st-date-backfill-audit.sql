-- =====================================================================
-- SQL MIGRATION: Create ST Date Backfill Audit Table
-- =====================================================================
-- Date: 2026-07-13
-- Purpose: Track all ST date updates with national holiday logic
-- Related: National Holidays 2026 Implementation
-- =====================================================================

-- Create audit table for ST date backfill
CREATE TABLE IF NOT EXISTS st_date_backfill_2026_audit (
    id SERIAL PRIMARY KEY,
    id_spk INT NOT NULL,
    id_toko INT NOT NULL,
    nomor_ulok TEXT NOT NULL,
    lingkup_pekerjaan TEXT NOT NULL,
    old_effective_waktu_selesai DATE NOT NULL,
    new_effective_st_date DATE NOT NULL,
    skipped_days INT NOT NULL,
    skipped_weekends INT NOT NULL DEFAULT 0,
    skipped_holidays INT NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL,
    backfilled_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    
    -- Foreign key constraints
    CONSTRAINT fk_st_backfill_spk FOREIGN KEY (id_spk) 
        REFERENCES pengajuan_spk(id) ON DELETE CASCADE,
    CONSTRAINT fk_st_backfill_toko FOREIGN KEY (id_toko) 
        REFERENCES toko(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_st_backfill_audit_id_toko 
    ON st_date_backfill_2026_audit(id_toko);

CREATE INDEX IF NOT EXISTS idx_st_backfill_audit_nomor_ulok 
    ON st_date_backfill_2026_audit(nomor_ulok);

CREATE INDEX IF NOT EXISTS idx_st_backfill_audit_backfilled_at 
    ON st_date_backfill_2026_audit(backfilled_at DESC);

-- Add comment
COMMENT ON TABLE st_date_backfill_2026_audit IS 
    'Audit trail untuk update tanggal ST dengan logic libur nasional 2026';

COMMENT ON COLUMN st_date_backfill_2026_audit.skipped_days IS 
    'Total hari yang diskip (weekend + libur nasional)';

COMMENT ON COLUMN st_date_backfill_2026_audit.skipped_weekends IS 
    'Jumlah hari weekend yang diskip';

COMMENT ON COLUMN st_date_backfill_2026_audit.skipped_holidays IS 
    'Jumlah libur nasional yang diskip';

COMMENT ON COLUMN st_date_backfill_2026_audit.explanation IS 
    'Label untuk Gantt Chart, contoh: "SPK+3 (2 weekend, 1 libur nasional)"';

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Check if table was created successfully
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'st_date_backfill_2026_audit'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'st_date_backfill_2026_audit';

-- =====================================================================
-- SAMPLE QUERIES FOR MONITORING
-- =====================================================================

-- View all backfilled records
-- SELECT * FROM st_date_backfill_2026_audit 
-- ORDER BY backfilled_at DESC;

-- Count by skipped days
-- SELECT 
--     skipped_days,
--     skipped_weekends,
--     skipped_holidays,
--     COUNT(*) as count
-- FROM st_date_backfill_2026_audit
-- GROUP BY skipped_days, skipped_weekends, skipped_holidays
-- ORDER BY skipped_days;

-- Find records with national holidays
-- SELECT * FROM st_date_backfill_2026_audit
-- WHERE skipped_holidays > 0
-- ORDER BY skipped_holidays DESC;

-- =====================================================================
-- ROLLBACK (if needed)
-- =====================================================================

-- DROP TABLE IF EXISTS st_date_backfill_2026_audit CASCADE;
