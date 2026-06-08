-- ============================================================
-- Migration: 2026-06-08-add-project-planning-fields.sql
-- Description:
--   - Add p_bangunan, l_bangunan, p_area_parkir, l_area_parkir
--   - Add jumlah_ac, pk_ac, listrik_va, listrik_phase
--   - Add sumber_air_bersih, drainase_air_kotor
-- ============================================================

ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS p_bangunan DECIMAL(15,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS l_bangunan DECIMAL(15,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS p_area_parkir DECIMAL(15,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS l_area_parkir DECIMAL(15,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS jumlah_ac INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pk_ac DECIMAL(10,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS listrik_va INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS listrik_phase INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS sumber_air_bersih VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS drainase_air_kotor VARCHAR(100) DEFAULT NULL;
