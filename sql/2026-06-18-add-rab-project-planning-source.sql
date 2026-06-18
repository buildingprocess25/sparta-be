-- Relasi audit asal Penawaran/RAB dari Permintaan Project Planning.
ALTER TABLE rab
    ADD COLUMN IF NOT EXISTS projek_planning_id INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_rab_projek_planning'
          AND conrelid = 'rab'::regclass
    ) THEN
        ALTER TABLE rab
            ADD CONSTRAINT fk_rab_projek_planning
            FOREIGN KEY (projek_planning_id)
            REFERENCES projek_planning(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rab_projek_planning_id
    ON rab(projek_planning_id);
