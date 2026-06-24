-- ============================================================
-- Migration: Normalisasi lingkup_pekerjaan ke UPPERCASE
-- Date: 2026-06-24
-- Problem: Terdapat 351 row toko dengan lingkup_pekerjaan='Sipil' (mixed case)
--          dan 349 row dengan 'SIPIL', menyebabkan false duplicate check
--          karena query pakai LOWER() comparison tapi constraint UNIQUE case-sensitive.
-- Fix: Normalisasi semua ke UPPERCASE agar konsisten.
-- ============================================================

BEGIN;

-- Normalisasi lingkup_pekerjaan: 'Sipil' → 'SIPIL', 'sipil' → 'SIPIL', dll
-- Hanya toko yang bukan data test/dummy
UPDATE toko
SET lingkup_pekerjaan = UPPER(TRIM(lingkup_pekerjaan))
WHERE lingkup_pekerjaan IS NOT NULL
  AND lingkup_pekerjaan != UPPER(TRIM(lingkup_pekerjaan))
  AND UPPER(TRIM(lingkup_pekerjaan)) IN ('SIPIL', 'ME');

-- Verifikasi hasil
DO $$
DECLARE
  sipil_count INT;
  me_count INT;
  mixed_count INT;
BEGIN
  SELECT COUNT(*) INTO sipil_count FROM toko WHERE lingkup_pekerjaan = 'SIPIL';
  SELECT COUNT(*) INTO me_count FROM toko WHERE lingkup_pekerjaan = 'ME';
  SELECT COUNT(*) INTO mixed_count FROM toko
    WHERE lingkup_pekerjaan IS NOT NULL
      AND UPPER(TRIM(lingkup_pekerjaan)) IN ('SIPIL','ME')
      AND lingkup_pekerjaan != UPPER(TRIM(lingkup_pekerjaan));

  RAISE NOTICE 'Setelah migrasi: SIPIL=%, ME=%, masih mixed case=%',
    sipil_count, me_count, mixed_count;

  IF mixed_count > 0 THEN
    RAISE EXCEPTION 'Masih ada % row dengan lingkup mixed case!', mixed_count;
  END IF;
END $$;

COMMIT;
