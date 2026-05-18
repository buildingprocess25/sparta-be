-- ============================================================
-- Migration: 2026-05-18-decouple-projek-planning-from-toko.sql
-- Description: Project Planning berdiri sendiri dari tabel toko.
--              ULOK baru/renovasi disimpan sebagai snapshot di
--              projek_planning, tanpa insert/update master toko.
-- Aman dijalankan berulang kali di DBeaver / Render PostgreSQL.
-- ============================================================

ALTER TABLE projek_planning
    ADD COLUMN IF NOT EXISTS alamat_toko TEXT DEFAULT NULL;

DO $$
DECLARE
    constraint_name_to_drop text;
BEGIN
    FOR constraint_name_to_drop IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'projek_planning'
          AND kcu.column_name = 'id_toko'
          AND ccu.table_name = 'toko'
    LOOP
        EXECUTE format('ALTER TABLE projek_planning DROP CONSTRAINT IF EXISTS %I', constraint_name_to_drop);
    END LOOP;
END $$;

ALTER TABLE projek_planning
    ALTER COLUMN id_toko DROP NOT NULL;

UPDATE projek_planning
SET id_toko = 0
WHERE id_toko IS NULL;

CREATE INDEX IF NOT EXISTS idx_projek_planning_nomor_ulok
    ON projek_planning(nomor_ulok);

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'projek_planning'
  AND column_name IN ('id_toko', 'nomor_ulok', 'nama_toko', 'kode_toko', 'cabang', 'alamat_toko')
ORDER BY column_name;
