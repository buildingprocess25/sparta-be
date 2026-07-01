-- Branch restructure support:
-- user_cabang.cabang remains the login branch, while this table stores the
-- original branches a user can access or approve.

CREATE TABLE IF NOT EXISTS user_branch_coverage (
    id SERIAL PRIMARY KEY,
    user_cabang_id INTEGER NOT NULL REFERENCES user_cabang(id) ON DELETE CASCADE,
    covered_cabang VARCHAR(255) NOT NULL,
    coverage_label VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_branch_coverage_user_cabang
        UNIQUE (user_cabang_id, covered_cabang)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_coverage_branch
    ON user_branch_coverage (UPPER(TRIM(covered_cabang)));

CREATE INDEX IF NOT EXISTS idx_user_branch_coverage_user
    ON user_branch_coverage (user_cabang_id);
