ALTER TABLE user_cabang
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_cabang_last_login_at
    ON user_cabang (last_login_at DESC);
