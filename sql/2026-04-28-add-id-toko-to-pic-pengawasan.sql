-- ============================================================
-- Migration: tambah id_toko ke pic_pengawasan
-- Date: 2026-04-28
-- Aman dijalankan berulang (idempotent)
-- ============================================================

BEGIN;

ALTER TABLE pic_pengawasan
    ADD COLUMN IF NOT EXISTS id_toko INT;

UPDATE pic_pengawasan p
SET id_toko = t.id
FROM toko t
WHERE p.id_toko IS NULL
  AND t.nomor_ulok = p.nomor_ulok;

DO $$
DECLARE
    v_missing_count INT;
    v_invalid_fk_count INT;
    v_duplicate_toko_count INT;
    v_row RECORD;
BEGIN
    SELECT COUNT(*) INTO v_missing_count
    FROM pic_pengawasan
    WHERE id_toko IS NULL;

    IF v_missing_count > 0 THEN
        RAISE NOTICE 'Baris pic_pengawasan tanpa id_toko (id, nomor_ulok):';
        FOR v_row IN
            SELECT id, nomor_ulok
            FROM pic_pengawasan
            WHERE id_toko IS NULL
            ORDER BY id
        LOOP
            RAISE NOTICE '  id=%, nomor_ulok=%', v_row.id, v_row.nomor_ulok;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO v_invalid_fk_count
    FROM pic_pengawasan p
    LEFT JOIN toko t ON t.id = p.id_toko
    WHERE p.id_toko IS NOT NULL
      AND t.id IS NULL;

    IF v_invalid_fk_count > 0 THEN
        RAISE NOTICE 'Baris pic_pengawasan dengan id_toko tidak valid (id, id_toko):';
        FOR v_row IN
            SELECT p.id, p.id_toko
            FROM pic_pengawasan p
            LEFT JOIN toko t ON t.id = p.id_toko
            WHERE p.id_toko IS NOT NULL
              AND t.id IS NULL
            ORDER BY p.id
        LOOP
            RAISE NOTICE '  id=%, id_toko=%', v_row.id, v_row.id_toko;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO v_duplicate_toko_count
    FROM (
        SELECT id_toko
        FROM pic_pengawasan
        WHERE id_toko IS NOT NULL
        GROUP BY id_toko
        HAVING COUNT(*) > 1
    ) dup;

    IF v_duplicate_toko_count > 0 THEN
        RAISE NOTICE 'Duplikasi id_toko ditemukan di pic_pengawasan (id_toko -> jumlah data):';
        FOR v_row IN
            SELECT id_toko, COUNT(*) AS jumlah
            FROM pic_pengawasan
            WHERE id_toko IS NOT NULL
            GROUP BY id_toko
            HAVING COUNT(*) > 1
            ORDER BY id_toko
        LOOP
            RAISE NOTICE '  id_toko=%, jumlah=%', v_row.id_toko, v_row.jumlah;
        END LOOP;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pic_pengawasan'
          AND column_name = 'id_toko'
          AND is_nullable = 'YES'
    ) AND v_missing_count = 0 THEN
        ALTER TABLE pic_pengawasan ALTER COLUMN id_toko SET NOT NULL;
    ELSIF v_missing_count > 0 THEN
        RAISE NOTICE 'Lewati SET NOT NULL: masih ada % baris id_toko NULL', v_missing_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'pic_pengawasan'
          AND constraint_name = 'uq_pic_pengawasan_id_toko'
    ) AND v_missing_count = 0 AND v_duplicate_toko_count = 0 THEN
        ALTER TABLE pic_pengawasan
        ADD CONSTRAINT uq_pic_pengawasan_id_toko UNIQUE (id_toko);
    ELSIF v_duplicate_toko_count > 0 THEN
        RAISE NOTICE 'Lewati UNIQUE uq_pic_pengawasan_id_toko: masih ada duplikasi id_toko';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'pic_pengawasan'
          AND constraint_name = 'fk_pic_pengawasan_toko_id'
    ) AND v_invalid_fk_count = 0 THEN
        ALTER TABLE pic_pengawasan
        ADD CONSTRAINT fk_pic_pengawasan_toko_id
        FOREIGN KEY (id_toko) REFERENCES toko(id) ON DELETE CASCADE;
    ELSIF v_invalid_fk_count > 0 THEN
        RAISE NOTICE 'Lewati FK fk_pic_pengawasan_toko_id: masih ada id_toko yang tidak valid';
    END IF;
END $$;

COMMIT;
