CREATE TABLE IF NOT EXISTS dc_archive_project (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE REFERENCES dc_project(id) ON DELETE CASCADE,
    archive_code VARCHAR(80) NOT NULL UNIQUE,
    archive_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(120) NOT NULL,
    location_name VARCHAR(255),
    project_type VARCHAR(120) NOT NULL,
    address TEXT,
    notes TEXT,
    created_by_email VARCHAR(255),
    created_by_role VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_archive_project_branch
ON dc_archive_project(branch_name);

CREATE INDEX IF NOT EXISTS idx_dc_archive_project_search
ON dc_archive_project(archive_code, archive_name);
