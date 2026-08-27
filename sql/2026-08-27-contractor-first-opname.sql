BEGIN;

ALTER TABLE pengawasan_gantt ADD COLUMN IF NOT EXISTS workflow_version text;
UPDATE pengawasan_gantt SET workflow_version = 'legacy' WHERE workflow_version IS NULL;
ALTER TABLE pengawasan_gantt ALTER COLUMN workflow_version SET DEFAULT 'contractor_first';
ALTER TABLE pengawasan_gantt ALTER COLUMN workflow_version SET NOT NULL;
ALTER TABLE pengawasan_gantt DROP CONSTRAINT IF EXISTS chk_pengawasan_gantt_workflow_version;
ALTER TABLE pengawasan_gantt ADD CONSTRAINT chk_pengawasan_gantt_workflow_version
  CHECK (workflow_version IN ('legacy', 'contractor_first'));

ALTER TABLE pengawasan_gantt ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE pengawasan_gantt SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE pengawasan_gantt ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE pengawasan_gantt ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE opname_final ADD COLUMN IF NOT EXISTS workflow_version text;
UPDATE opname_final SET workflow_version = 'legacy' WHERE workflow_version IS NULL;
ALTER TABLE opname_final ALTER COLUMN workflow_version SET DEFAULT 'contractor_first';
ALTER TABLE opname_final ALTER COLUMN workflow_version SET NOT NULL;
ALTER TABLE opname_final DROP CONSTRAINT IF EXISTS chk_opname_final_workflow_version;
ALTER TABLE opname_final ADD CONSTRAINT chk_opname_final_workflow_version
  CHECK (workflow_version IN ('legacy', 'contractor_first'));

ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS workflow_version text;
UPDATE opname_item SET workflow_version = 'legacy' WHERE workflow_version IS NULL;
ALTER TABLE opname_item ALTER COLUMN workflow_version SET DEFAULT 'contractor_first';
ALTER TABLE opname_item ALTER COLUMN workflow_version SET NOT NULL;
ALTER TABLE opname_item DROP CONSTRAINT IF EXISTS chk_opname_item_workflow_version;
ALTER TABLE opname_item ADD CONSTRAINT chk_opname_item_workflow_version
  CHECK (workflow_version IN ('legacy', 'contractor_first'));

ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS id_pengawasan_gantt_target integer;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS tanggal_slot_opname date;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS submitted_by_email text;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS reviewed_by_email text;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS alasan_penolakan_support text;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS revision_no integer NOT NULL DEFAULT 0;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS revision_parent_id integer;
ALTER TABLE opname_item ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE opname_item DROP CONSTRAINT IF EXISTS fk_opname_item_pengawasan_gantt_target;
ALTER TABLE opname_item ADD CONSTRAINT fk_opname_item_pengawasan_gantt_target
  FOREIGN KEY (id_pengawasan_gantt_target) REFERENCES pengawasan_gantt(id) ON DELETE SET NULL;

ALTER TABLE opname_item DROP CONSTRAINT IF EXISTS fk_opname_item_revision_parent;
ALTER TABLE opname_item ADD CONSTRAINT fk_opname_item_revision_parent
  FOREIGN KEY (revision_parent_id) REFERENCES opname_item(id) ON DELETE SET NULL;

ALTER TABLE opname_item DROP CONSTRAINT IF EXISTS chk_opname_item_contractor_first_target;
ALTER TABLE opname_item ADD CONSTRAINT chk_opname_item_contractor_first_target
  CHECK (
    workflow_version = 'legacy'
    OR (id_pengawasan_gantt_target IS NOT NULL AND tanggal_slot_opname IS NOT NULL)
  );

ALTER TABLE opname_item DROP CONSTRAINT IF EXISTS chk_opname_item_support_reject_reason;
ALTER TABLE opname_item ADD CONSTRAINT chk_opname_item_support_reject_reason
  CHECK (
    workflow_version = 'legacy'
    OR status <> 'ditolak'
    OR nullif(trim(alasan_penolakan_support), '') IS NOT NULL
  );

CREATE TABLE IF NOT EXISTS opname_item_revision_history (
  id serial PRIMARY KEY,
  id_opname_item integer NOT NULL REFERENCES opname_item(id) ON DELETE CASCADE,
  revision_no integer NOT NULL DEFAULT 0,
  previous_status varchar,
  next_status varchar NOT NULL,
  volume_akhir numeric,
  desain varchar,
  kualitas varchar,
  spesifikasi varchar,
  foto text,
  catatan_kontraktor text,
  alasan_penolakan_support text,
  actor_email text,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opname_item_workflow_target_status
  ON opname_item(workflow_version, id_pengawasan_gantt_target, status);
CREATE INDEX IF NOT EXISTS idx_opname_item_rab_target
  ON opname_item(id_toko, id_rab_item, id_pengawasan_gantt_target);
CREATE INDEX IF NOT EXISTS idx_opname_item_il_target
  ON opname_item(id_toko, id_instruksi_lapangan_item, id_pengawasan_gantt_target);
CREATE INDEX IF NOT EXISTS idx_opname_item_status_workflow
  ON opname_item(status, workflow_version);

COMMIT;
