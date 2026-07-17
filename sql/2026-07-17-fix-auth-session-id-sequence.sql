-- Fix auth_session.id after database migration/import.
-- Symptom:
--   null value in column "id" of relation "auth_session" violates not-null constraint
--
-- Cause:
--   Existing auth_session table has an id column, but no sequence/default.

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

SELECT
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'auth_session'
  AND column_name = 'id';
