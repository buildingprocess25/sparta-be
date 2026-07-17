-- Repair auth id sequences after DB import/migration.
-- Run this once on the VPS PostgreSQL database if login fails with:
--   null value in column "id" of relation "auth_session" violates not-null constraint
-- or:
--   null value in column "id" of relation "auth_otp" violates not-null constraint

DO $$
DECLARE
    seq_name text;
BEGIN
    SELECT pg_get_serial_sequence('auth_session', 'id') INTO seq_name;

    IF seq_name IS NULL THEN
        CREATE SEQUENCE IF NOT EXISTS auth_session_id_seq OWNED BY auth_session.id;
        ALTER TABLE auth_session
            ALTER COLUMN id SET DEFAULT nextval('auth_session_id_seq'::regclass);
        seq_name := 'auth_session_id_seq';
    END IF;

    EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id) FROM auth_session), 0) + 1, 1), false)',
        seq_name
    );
END $$;

DO $$
DECLARE
    seq_name text;
BEGIN
    SELECT pg_get_serial_sequence('auth_otp', 'id') INTO seq_name;

    IF seq_name IS NULL THEN
        CREATE SEQUENCE IF NOT EXISTS auth_otp_id_seq OWNED BY auth_otp.id;
        ALTER TABLE auth_otp
            ALTER COLUMN id SET DEFAULT nextval('auth_otp_id_seq'::regclass);
        seq_name := 'auth_otp_id_seq';
    END IF;

    EXECUTE format(
        'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id) FROM auth_otp), 0) + 1, 1), false)',
        seq_name
    );
END $$;

SELECT
    table_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('auth_session', 'auth_otp')
  AND column_name = 'id'
ORDER BY table_name;
