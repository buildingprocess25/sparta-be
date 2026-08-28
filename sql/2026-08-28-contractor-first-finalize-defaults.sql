BEGIN;

-- Run this only when the contractor-first FE/BE branch is deployed as production.
-- During compatibility testing, keep using 2026-08-28-contractor-first-prod-compatible.sql.

ALTER TABLE pengawasan_gantt ALTER COLUMN workflow_version SET DEFAULT 'contractor_first';

-- The new BE writes contractor-first opname rows explicitly, and legacy paths write
-- legacy explicitly. Keeping these defaults legacy reduces blast radius for any old
-- helper/script that still inserts opname rows without workflow metadata.
ALTER TABLE opname_final ALTER COLUMN workflow_version SET DEFAULT 'legacy';
ALTER TABLE opname_item ALTER COLUMN workflow_version SET DEFAULT 'legacy';

COMMIT;