-- ============================================================
-- Migration: rename Direktur role/status label to Direktur Kontraktor
-- Date: 2026-05-25
-- Safe to run repeatedly.
-- ============================================================

BEGIN;

UPDATE user_cabang
SET jabatan = 'Direktur Kontraktor'
WHERE LOWER(BTRIM(jabatan)) = LOWER('Direktur');

UPDATE rab
SET status = 'Menunggu Persetujuan Direktur Kontraktor'
WHERE status = 'Menunggu Persetujuan Direktur';

UPDATE rab
SET status = 'Ditolak oleh Direktur Kontraktor'
WHERE status = 'Ditolak oleh Direktur';

UPDATE opname_final
SET status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
WHERE status_opname_final = 'Menunggu Persetujuan Direktur';

UPDATE opname_final
SET status_opname_final = 'Ditolak oleh Direktur Kontraktor'
WHERE status_opname_final = 'Ditolak oleh Direktur';

COMMIT;
