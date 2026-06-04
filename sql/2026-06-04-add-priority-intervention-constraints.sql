-- Extend Project Planning audit constraints for Super Human intervention logs.
-- Safe to rerun: constraints are replaced with the expanded value set.

ALTER TABLE projek_planning_log
DROP CONSTRAINT IF EXISTS chk_projek_planning_log_aksi;

ALTER TABLE projek_planning_log
ADD CONSTRAINT chk_projek_planning_log_aksi
CHECK (aksi IN (
    'SUBMIT',
    'APPROVE',
    'REJECT',
    'UPLOAD_3D',
    'UPLOAD_RAB',
    'COMPLETE',
    'INTERVENTION'
));

ALTER TABLE projek_planning_log
DROP CONSTRAINT IF EXISTS chk_projek_planning_log_role;

ALTER TABLE projek_planning_log
ADD CONSTRAINT chk_projek_planning_log_role
CHECK (role IN (
    'COORDINATOR',
    'BM',
    'PP_SPECIALIST',
    'PP_MANAGER',
    'SUPER_HUMAN'
));
