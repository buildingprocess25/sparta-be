CREATE TABLE IF NOT EXISTS dc_document_custom_item (
    id SERIAL PRIMARY KEY,
    archive_project_id INTEGER NOT NULL REFERENCES dc_archive_project(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES dc_project(id) ON DELETE CASCADE,
    stage VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    created_by_email VARCHAR(255),
    created_by_role VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    deleted_at TIMESTAMP NULL,
    CONSTRAINT ck_dc_document_custom_item_stage
        CHECK (stage IN ('PEMBANGUNAN', 'RENOVASI', 'PERLUASAN')),
    CONSTRAINT ck_dc_document_custom_item_slots_array
        CHECK (jsonb_typeof(slots) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_dc_document_custom_item_archive_stage
ON dc_document_custom_item(archive_project_id, stage)
WHERE status <> 'DELETED';

CREATE INDEX IF NOT EXISTS idx_dc_document_custom_item_project_stage
ON dc_document_custom_item(project_id, stage)
WHERE status <> 'DELETED';
