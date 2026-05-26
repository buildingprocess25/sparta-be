-- Generic audit trail for cross-module activity and Super Human interventions.

CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    actor_email VARCHAR(255),
    actor_role VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    status_before TEXT,
    status_after TEXT,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity
    ON activity_log(entity_type, entity_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_activity_log_actor
    ON activity_log(actor_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_action
    ON activity_log(action, created_at DESC);
