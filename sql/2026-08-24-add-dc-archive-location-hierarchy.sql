ALTER TABLE dc_archive_project
    ADD COLUMN IF NOT EXISTS archive_type VARCHAR(40),
    ADD COLUMN IF NOT EXISTS initial_code VARCHAR(80),
    ADD COLUMN IF NOT EXISTS parent_dc_code VARCHAR(80),
    ADD COLUMN IF NOT EXISTS parent_dc_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS parent_branch_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_dc_archive_project_archive_type
ON dc_archive_project(archive_type);

CREATE INDEX IF NOT EXISTS idx_dc_archive_project_parent_dc
ON dc_archive_project(parent_dc_code);

CREATE INDEX IF NOT EXISTS idx_dc_archive_project_parent_branch
ON dc_archive_project(parent_branch_name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dc_archive_project_archive_code
ON dc_archive_project(archive_code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dc_project_project_code
ON dc_project(project_code);
