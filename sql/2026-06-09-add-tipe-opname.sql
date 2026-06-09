ALTER TABLE opname_final
    ADD COLUMN IF NOT EXISTS tipe_opname VARCHAR(50) NOT NULL DEFAULT 'OPNAME';

UPDATE opname_final
SET tipe_opname = 'OPNAME'
WHERE tipe_opname IS NULL OR tipe_opname NOT IN ('OPNAME', 'OPNAME_FINAL');

ALTER TABLE opname_final
    ALTER COLUMN tipe_opname SET DEFAULT 'OPNAME',
    ALTER COLUMN tipe_opname SET NOT NULL,
    ALTER COLUMN status_opname_final SET DEFAULT 'Proses KTK/Approval Kontraktor';

UPDATE opname_final
SET status_opname_final = 'Proses KTK/Approval Kontraktor'
WHERE aksi = 'active'
  AND status_opname_final = 'Menunggu Persetujuan Koordinator';

ALTER TABLE opname_final
    DROP CONSTRAINT IF EXISTS chk_opname_final_tipe;

ALTER TABLE opname_final
    ADD CONSTRAINT chk_opname_final_tipe
    CHECK (tipe_opname IN ('OPNAME', 'OPNAME_FINAL'));

CREATE INDEX IF NOT EXISTS idx_opname_final_tipe ON opname_final(tipe_opname);
CREATE INDEX IF NOT EXISTS idx_opname_final_tipe_aksi ON opname_final(tipe_opname, aksi);
