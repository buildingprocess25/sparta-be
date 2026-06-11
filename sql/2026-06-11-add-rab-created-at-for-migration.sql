-- Ensure RAB has a creation timestamp column before running RAB migration.
-- Existing old rows are intentionally left NULL so the migration preview can
-- identify records whose created_at should be restored from the Excel source.

ALTER TABLE rab
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

ALTER TABLE rab
ALTER COLUMN created_at SET DEFAULT timezone('Asia/Jakarta', now());

CREATE INDEX IF NOT EXISTS idx_rab_created_at
ON rab (created_at DESC, id DESC);
