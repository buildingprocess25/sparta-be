-- ============================================================
-- Migration: 2026-06-03-update-fpd-head-to-head-rab-workflow.sql
-- Description:
--   Penyesuaian FPD:
--   - Siteplan, luasan, P x L, jarak head-to-head.
--   - Relasi FPD ke RAB Sparta approved.
--   - Approval B&M tahap 2.
--   - Review final terpisah untuk RAB dan gambar final.
--   Aman dijalankan berulang kali di DBeaver.
-- ============================================================

ALTER TABLE projek_planning
    DROP COLUMN IF EXISTS link_gambar_rab_sipil,
    DROP COLUMN IF EXISTS link_gambar_rab_me,
    DROP COLUMN IF EXISTS link_gambar_kerja_final;

ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS link_siteplan TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS luas_bangunan VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS luas_area_terbuka VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS luas_area_terbangun VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS luas_gudang VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS luas_area_parkir VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS luas_area_sales VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pxl_bangunan VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pxl_area_parkir VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS jarak_head_to_head VARCHAR(50) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS id_rab_sipil INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS id_rab_me INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bm2_approver_email VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bm2_waktu_persetujuan TIMESTAMP DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bm2_alasan_penolakan TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp2_rab_status VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp2_gambar_status VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp2_rab_rejected_item_ids INTEGER[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp2_rab_rejected_item_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp_manager_rab_status VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp_manager_gambar_status VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp_manager_rab_rejected_item_ids INTEGER[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pp_manager_rab_rejected_item_notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_projek_planning_id_rab_sipil ON projek_planning(id_rab_sipil);
CREATE INDEX IF NOT EXISTS idx_projek_planning_id_rab_me ON projek_planning(id_rab_me);
CREATE INDEX IF NOT EXISTS idx_projek_planning_status_bm2 ON projek_planning(status)
WHERE status = 'WAITING_BM_APPROVAL_2';
