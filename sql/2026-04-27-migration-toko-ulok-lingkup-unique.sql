-- ============================================================
-- Migration: ubah unique toko dari nomor_ulok -> (nomor_ulok, lingkup_pekerjaan)
-- Date: 2026-04-27
-- Aman dijalankan berulang (idempotent)
-- ============================================================

BEGIN;

-- 1) Drop unique lama di nomor_ulok (nama constraint bisa berbeda antar env)
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT con.conname
    INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'toko'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) = 'UNIQUE (nomor_ulok)'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.toko DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- 2) Deduplikasi data toko yang konflik pada kombinasi (nomor_ulok, lingkup_pekerjaan)
--    Strategi:
--    - Simpan row dengan id terbesar sebagai canonical (keeper)
--    - Repoint semua FK ke keeper (dinamis untuk semua tabel yang refer ke toko.id)
--    - Hapus row duplikat
DO $$
DECLARE
    fk_record record;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _toko_dedup_map (
        dupe_id   int PRIMARY KEY,
        keeper_id int NOT NULL
    ) ON COMMIT DROP;

    TRUNCATE TABLE _toko_dedup_map;

    INSERT INTO _toko_dedup_map (dupe_id, keeper_id)
    WITH ranked AS (
        SELECT
            id,
            FIRST_VALUE(id) OVER (
                PARTITION BY nomor_ulok, lingkup_pekerjaan
                ORDER BY id DESC
            ) AS keeper_id,
            ROW_NUMBER() OVER (
                PARTITION BY nomor_ulok, lingkup_pekerjaan
                ORDER BY id DESC
            ) AS rn
        FROM public.toko
        WHERE nomor_ulok IS NOT NULL
          AND lingkup_pekerjaan IS NOT NULL
    )
    SELECT id AS dupe_id, keeper_id
    FROM ranked
    WHERE rn > 1;

    IF EXISTS (SELECT 1 FROM _toko_dedup_map) THEN
        FOR fk_record IN
            SELECT
                nsp.nspname AS table_schema,
                cls.relname AS table_name,
                att.attname AS column_name
            FROM pg_constraint con
            JOIN pg_class cls ON cls.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
            JOIN LATERAL unnest(con.conkey) AS key_col(attnum) ON true
            JOIN pg_attribute att
                ON att.attrelid = cls.oid
               AND att.attnum = key_col.attnum
            WHERE con.contype = 'f'
              AND con.confrelid = 'public.toko'::regclass
              AND array_length(con.conkey, 1) = 1
        LOOP
            EXECUTE format(
                'UPDATE %I.%I t
                 SET %I = m.keeper_id
                 FROM _toko_dedup_map m
                 WHERE t.%I = m.dupe_id',
                fk_record.table_schema,
                fk_record.table_name,
                fk_record.column_name,
                fk_record.column_name
            );
        END LOOP;

        DELETE FROM public.toko t
        USING _toko_dedup_map m
        WHERE t.id = m.dupe_id;
    END IF;
END $$;

-- 3) Tambah unique baru kombinasi nomor_ulok + lingkup_pekerjaan
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'toko'
          AND con.contype = 'u'
          AND con.conname = 'uq_toko_nomor_ulok_lingkup'
    ) THEN
        ALTER TABLE public.toko
        ADD CONSTRAINT uq_toko_nomor_ulok_lingkup
        UNIQUE (nomor_ulok, lingkup_pekerjaan);
    END IF;
END $$;

-- 4) Sinkronkan sequence primary key toko.id
--    Mencegah error: duplicate key value violates unique constraint "toko_pkey"
--    saat sequence tertinggal setelah import/manual migration.
DO $$
DECLARE
    max_id bigint;
    seq_name text;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.toko;
    seq_name := pg_get_serial_sequence('public.toko', 'id');

    IF seq_name IS NOT NULL THEN
        IF max_id = 0 THEN
            EXECUTE format('SELECT setval(%L, 1, false)', seq_name);
        ELSE
            EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id);
        END IF;
    END IF;
END $$;

COMMIT;
