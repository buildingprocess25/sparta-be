BEGIN;

ALTER TABLE opname_item
    ADD COLUMN IF NOT EXISTS id_instruksi_lapangan_item INT;

ALTER TABLE opname_item
    ALTER COLUMN id_rab_item DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'opname_item'
          AND constraint_name = 'fk_opname_item_instruksi_lapangan_item'
    ) THEN
        ALTER TABLE opname_item
            ADD CONSTRAINT fk_opname_item_instruksi_lapangan_item
            FOREIGN KEY (id_instruksi_lapangan_item)
            REFERENCES instruksi_lapangan_item(id)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'opname_item'
          AND constraint_name = 'chk_opname_item_source'
    ) THEN
        ALTER TABLE opname_item
            ADD CONSTRAINT chk_opname_item_source
            CHECK (
                (id_rab_item IS NOT NULL AND id_instruksi_lapangan_item IS NULL)
                OR
                (id_rab_item IS NULL AND id_instruksi_lapangan_item IS NOT NULL)
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opname_item_id_instruksi_lapangan_item
    ON opname_item(id_instruksi_lapangan_item);

COMMIT;
