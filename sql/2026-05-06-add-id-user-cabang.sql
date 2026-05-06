-- Add id primary key to user_cabang table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_cabang'
          AND column_name = 'id'
    ) THEN
        CREATE SEQUENCE IF NOT EXISTS user_cabang_id_seq;
        ALTER TABLE user_cabang ADD COLUMN id INT;
        ALTER TABLE user_cabang ALTER COLUMN id SET DEFAULT nextval('user_cabang_id_seq');
    END IF;
END $$;

UPDATE user_cabang
SET id = nextval('user_cabang_id_seq')
WHERE id IS NULL;

ALTER TABLE user_cabang
ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_cabang_pkey'
    ) THEN
        ALTER TABLE user_cabang ADD CONSTRAINT user_cabang_pkey PRIMARY KEY (id);
    END IF;
END $$;
