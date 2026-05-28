-- Standalone DC Development workflow foundation.
-- This module intentionally does not depend on toko/RAB/SPK/Gantt legacy tables.

CREATE TABLE IF NOT EXISTS dc_project (
    id SERIAL PRIMARY KEY,
    project_code VARCHAR(80) NOT NULL UNIQUE,
    project_name VARCHAR(255) NOT NULL,
    location_name VARCHAR(255),
    branch_name VARCHAR(120),
    address TEXT,
    area_size NUMERIC(14,2),
    status VARCHAR(80) NOT NULL DEFAULT 'PROJECT_CREATED',
    current_stage VARCHAR(80) NOT NULL DEFAULT 'PROJECT_CREATED',
    created_by_email VARCHAR(255),
    created_by_role VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_project_status ON dc_project(status);
CREATE INDEX IF NOT EXISTS idx_dc_project_stage ON dc_project(current_stage);
CREATE INDEX IF NOT EXISTS idx_dc_project_branch ON dc_project(branch_name);

CREATE TABLE IF NOT EXISTS dc_vendor_company (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    npwp VARCHAR(80),
    address TEXT,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(80),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_by_email VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_vendor_company_name ON dc_vendor_company(company_name);
CREATE INDEX IF NOT EXISTS idx_dc_vendor_company_status ON dc_vendor_company(status);

CREATE TABLE IF NOT EXISTS dc_vendor_user (
    id SERIAL PRIMARY KEY,
    vendor_company_id INTEGER NOT NULL REFERENCES dc_vendor_company(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(80),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    UNIQUE (vendor_company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_dc_vendor_user_email ON dc_vendor_user(email);

CREATE TABLE IF NOT EXISTS dc_vendor_service (
    id SERIAL PRIMARY KEY,
    vendor_company_id INTEGER NOT NULL REFERENCES dc_vendor_company(id) ON DELETE CASCADE,
    service_type VARCHAR(80) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    UNIQUE (vendor_company_id, service_type)
);

CREATE TABLE IF NOT EXISTS dc_tender (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES dc_project(id) ON DELETE CASCADE,
    tender_type VARCHAR(80) NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'DRAFT',
    title VARCHAR(255) NOT NULL,
    owner_estimate_amount NUMERIC(18,2),
    oe_tolerance_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
    winner_participant_id INTEGER,
    created_by_email VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    UNIQUE (project_id, tender_type)
);

CREATE INDEX IF NOT EXISTS idx_dc_tender_project ON dc_tender(project_id);
CREATE INDEX IF NOT EXISTS idx_dc_tender_type_status ON dc_tender(tender_type, status);

CREATE TABLE IF NOT EXISTS dc_tender_participant (
    id SERIAL PRIMARY KEY,
    tender_id INTEGER NOT NULL REFERENCES dc_tender(id) ON DELETE CASCADE,
    vendor_company_id INTEGER NOT NULL REFERENCES dc_vendor_company(id),
    status VARCHAR(80) NOT NULL DEFAULT 'INVITED',
    invited_by_email VARCHAR(255),
    invited_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    last_note TEXT,
    UNIQUE (tender_id, vendor_company_id)
);

CREATE INDEX IF NOT EXISTS idx_dc_tender_participant_tender ON dc_tender_participant(tender_id);
CREATE INDEX IF NOT EXISTS idx_dc_tender_participant_vendor ON dc_tender_participant(vendor_company_id);
CREATE INDEX IF NOT EXISTS idx_dc_tender_participant_status ON dc_tender_participant(status);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_dc_tender_winner'
    ) THEN
        ALTER TABLE dc_tender
            ADD CONSTRAINT fk_dc_tender_winner
            FOREIGN KEY (winner_participant_id) REFERENCES dc_tender_participant(id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS dc_tender_submission (
    id SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL REFERENCES dc_tender_participant(id) ON DELETE CASCADE,
    submission_type VARCHAR(80) NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'SUBMITTED',
    submitted_offer_amount NUMERIC(18,2),
    offer_vs_oe_percent NUMERIC(9,4),
    oe_review_required BOOLEAN NOT NULL DEFAULT false,
    oe_review_status VARCHAR(80),
    notes TEXT,
    submitted_by_email VARCHAR(255),
    submitted_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_tender_submission_participant ON dc_tender_submission(participant_id);
CREATE INDEX IF NOT EXISTS idx_dc_tender_submission_status ON dc_tender_submission(status);

CREATE TABLE IF NOT EXISTS dc_document (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES dc_project(id) ON DELETE CASCADE,
    tender_id INTEGER REFERENCES dc_tender(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES dc_tender_participant(id) ON DELETE CASCADE,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INTEGER,
    document_type VARCHAR(120) NOT NULL,
    stage VARCHAR(80),
    status VARCHAR(80) NOT NULL DEFAULT 'ACTIVE',
    created_by_email VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_document_project ON dc_document(project_id);
CREATE INDEX IF NOT EXISTS idx_dc_document_tender ON dc_document(tender_id);
CREATE INDEX IF NOT EXISTS idx_dc_document_type ON dc_document(document_type);
CREATE INDEX IF NOT EXISTS idx_dc_document_entity ON dc_document(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS dc_document_version (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES dc_document(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(180),
    size_bytes BIGINT,
    notes TEXT,
    uploaded_by_email VARCHAR(255),
    uploaded_by_role VARCHAR(255),
    is_current BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    UNIQUE (document_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_dc_document_version_document ON dc_document_version(document_id);
CREATE INDEX IF NOT EXISTS idx_dc_document_version_current ON dc_document_version(document_id, is_current);

CREATE TABLE IF NOT EXISTS dc_approval (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES dc_project(id) ON DELETE CASCADE,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INTEGER NOT NULL,
    approval_type VARCHAR(80) NOT NULL,
    required_role VARCHAR(255) NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'PENDING',
    actor_email VARCHAR(255),
    actor_role VARCHAR(255),
    action VARCHAR(80),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    acted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dc_approval_status_role ON dc_approval(status, required_role);
CREATE INDEX IF NOT EXISTS idx_dc_approval_entity ON dc_approval(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dc_approval_project ON dc_approval(project_id);

CREATE TABLE IF NOT EXISTS dc_monitoring_report (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES dc_project(id) ON DELETE CASCADE,
    report_type VARCHAR(40) NOT NULL,
    report_date DATE,
    period_start DATE,
    period_end DATE,
    physical_progress NUMERIC(7,4),
    work_summary TEXT,
    issues TEXT,
    next_action TEXT,
    status VARCHAR(80) NOT NULL DEFAULT 'DRAFT',
    submitted_by_email VARCHAR(255),
    reviewed_by_email VARCHAR(255),
    review_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_monitoring_project ON dc_monitoring_report(project_id);
CREATE INDEX IF NOT EXISTS idx_dc_monitoring_type_status ON dc_monitoring_report(report_type, status);

CREATE TABLE IF NOT EXISTS dc_supervision_visit (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES dc_project(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    visitor_email VARCHAR(255),
    visitor_role VARCHAR(255),
    location TEXT,
    summary TEXT,
    status VARCHAR(80) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_supervision_visit_project ON dc_supervision_visit(project_id);

CREATE TABLE IF NOT EXISTS dc_supervision_finding (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES dc_supervision_visit(id) ON DELETE CASCADE,
    category VARCHAR(120),
    description TEXT NOT NULL,
    severity VARCHAR(40) NOT NULL DEFAULT 'MEDIUM',
    assigned_to_type VARCHAR(80),
    due_date DATE,
    status VARCHAR(80) NOT NULL DEFAULT 'OPEN',
    follow_up_notes TEXT,
    close_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_supervision_finding_visit ON dc_supervision_finding(visit_id);
CREATE INDEX IF NOT EXISTS idx_dc_supervision_finding_status ON dc_supervision_finding(status);

CREATE TABLE IF NOT EXISTS dc_term_schedule (
    id SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL REFERENCES dc_tender_participant(id) ON DELETE CASCADE,
    term_no INTEGER NOT NULL,
    percentage NUMERIC(7,4) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    requirements TEXT,
    status VARCHAR(80) NOT NULL DEFAULT 'PROPOSED',
    approved_by_email VARCHAR(255),
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    UNIQUE (participant_id, term_no)
);

CREATE INDEX IF NOT EXISTS idx_dc_term_schedule_participant ON dc_term_schedule(participant_id);
CREATE INDEX IF NOT EXISTS idx_dc_term_schedule_status ON dc_term_schedule(status);

CREATE TABLE IF NOT EXISTS dc_term_claim (
    id SERIAL PRIMARY KEY,
    term_schedule_id INTEGER NOT NULL REFERENCES dc_term_schedule(id) ON DELETE CASCADE,
    claimed_amount NUMERIC(18,2) NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'SUBMITTED',
    submitted_by_email VARCHAR(255),
    review_notes TEXT,
    submitted_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_term_claim_schedule ON dc_term_claim(term_schedule_id);
CREATE INDEX IF NOT EXISTS idx_dc_term_claim_status ON dc_term_claim(status);

CREATE TABLE IF NOT EXISTS dc_bast (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES dc_project(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES dc_tender_participant(id),
    bast_type VARCHAR(80) NOT NULL,
    status VARCHAR(80) NOT NULL DEFAULT 'DRAFT',
    checklist JSONB,
    notes TEXT,
    submitted_by_email VARCHAR(255),
    approved_by_email VARCHAR(255),
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_bast_project ON dc_bast(project_id);
CREATE INDEX IF NOT EXISTS idx_dc_bast_status ON dc_bast(status);

CREATE TABLE IF NOT EXISTS dc_activity_log (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES dc_project(id) ON DELETE CASCADE,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INTEGER,
    actor_email VARCHAR(255),
    actor_role VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    status_before TEXT,
    status_after TEXT,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_dc_activity_project ON dc_activity_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dc_activity_entity ON dc_activity_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dc_activity_actor ON dc_activity_log(actor_email, created_at DESC);
