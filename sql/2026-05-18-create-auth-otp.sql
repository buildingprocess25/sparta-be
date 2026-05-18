CREATE TABLE IF NOT EXISTS auth_otp (
    id SERIAL PRIMARY KEY,
    email_sat VARCHAR(255) NOT NULL,
    cabang VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    otp_token VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    consumed_at TIMESTAMPTZ DEFAULT NULL
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_otp'
          AND column_name = 'expires_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE auth_otp
            ALTER COLUMN expires_at TYPE TIMESTAMPTZ
            USING expires_at AT TIME ZONE 'Asia/Jakarta';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_otp'
          AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE auth_otp
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
            USING created_at AT TIME ZONE 'Asia/Jakarta';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_otp'
          AND column_name = 'consumed_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE auth_otp
            ALTER COLUMN consumed_at TYPE TIMESTAMPTZ
            USING consumed_at AT TIME ZONE 'Asia/Jakarta';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_otp_lookup
    ON auth_otp (email_sat, cabang, otp_token);

CREATE INDEX IF NOT EXISTS idx_auth_otp_active
    ON auth_otp (email_sat, cabang, expires_at)
    WHERE consumed_at IS NULL;
