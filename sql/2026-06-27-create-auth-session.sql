CREATE TABLE IF NOT EXISTS auth_session (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    email_sat VARCHAR(255) NOT NULL,
    cabang VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(255),
    jabatan VARCHAR(255),
    roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    nama_pt VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_session_active_token
    ON auth_session (token_hash, expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_session_email_cabang
    ON auth_session (email_sat, cabang, expires_at)
    WHERE revoked_at IS NULL;
