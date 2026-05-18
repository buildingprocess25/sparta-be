CREATE TABLE IF NOT EXISTS auth_otp (
    id SERIAL PRIMARY KEY,
    email_sat VARCHAR(255) NOT NULL,
    cabang VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    otp_token VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('Asia/Jakarta', now()),
    consumed_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_lookup
    ON auth_otp (email_sat, cabang, otp_token);

CREATE INDEX IF NOT EXISTS idx_auth_otp_active
    ON auth_otp (email_sat, cabang, expires_at)
    WHERE consumed_at IS NULL;
