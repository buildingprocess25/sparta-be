CREATE TABLE IF NOT EXISTS dc_project_member (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES dc_project(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    member_type VARCHAR(40) NOT NULL DEFAULT 'INTERNAL',
    access_level VARCHAR(40) NOT NULL DEFAULT 'VIEW',
    source_entity_type VARCHAR(80),
    source_entity_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dc_project_member_identity
ON dc_project_member (
    project_id,
    LOWER(email),
    COALESCE(source_entity_type, ''),
    COALESCE(source_entity_id, 0)
);

CREATE INDEX IF NOT EXISTS idx_dc_project_member_project
ON dc_project_member(project_id);

CREATE INDEX IF NOT EXISTS idx_dc_project_member_email
ON dc_project_member(LOWER(email));

ALTER TABLE dc_document
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE dc_document_version
    ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS link_dokumen TEXT,
    ADD COLUMN IF NOT EXISTS link_folder TEXT;

CREATE INDEX IF NOT EXISTS idx_dc_document_status_project
ON dc_document(project_id, status);

INSERT INTO dc_project_member (
    project_id,
    email,
    role,
    member_type,
    access_level,
    source_entity_type,
    source_entity_id,
    created_at,
    updated_at
)
SELECT
    id,
    created_by_email,
    created_by_role,
    'INTERNAL',
    'MANAGE',
    'DC_PROJECT',
    id,
    timezone('Asia/Jakarta', now()),
    timezone('Asia/Jakarta', now())
FROM dc_project
WHERE created_by_email IS NOT NULL
  AND TRIM(created_by_email) <> ''
ON CONFLICT DO NOTHING;
