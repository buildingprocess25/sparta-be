ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS akhir_masa_sewa DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS spd NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS link_ba_tidak_sesuai_standar TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bm_regional_approver_email VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bm_regional_waktu_persetujuan TIMESTAMP DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bm_regional_alasan_penolakan TEXT DEFAULT NULL;

ALTER TABLE projek_planning
DROP CONSTRAINT IF EXISTS chk_projek_planning_status;

ALTER TABLE projek_planning
ADD CONSTRAINT chk_projek_planning_status CHECK (status IN (
    'DRAFT',
    'WAITING_BM_APPROVAL',
    'WAITING_PP_APPROVAL_1',
    'PP_DESIGN_3D_REQUIRED',
    'WAITING_RAB_UPLOAD',
    'WAITING_BM_APPROVAL_2',
    'WAITING_BM_REGIONAL_APPROVAL',
    'WAITING_PP_MANAGER_APPROVAL',
    'WAITING_PP_APPROVAL_2',
    'COMPLETED',
    'REJECTED'
));

ALTER TABLE projek_planning_log
DROP CONSTRAINT IF EXISTS chk_projek_planning_log_role;

ALTER TABLE projek_planning_log
ADD CONSTRAINT chk_projek_planning_log_role CHECK (role IN (
    'COORDINATOR',
    'BM',
    'BM_REGIONAL',
    'PP_SPECIALIST',
    'PP_MANAGER',
    'SUPER_HUMAN'
));

CREATE INDEX IF NOT EXISTS idx_projek_planning_status_bm_regional
    ON projek_planning(status)
    WHERE status = 'WAITING_BM_REGIONAL_APPROVAL';
