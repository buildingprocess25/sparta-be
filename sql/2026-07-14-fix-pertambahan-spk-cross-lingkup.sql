-- ============================================================================
-- Fix: Pertambahan SPK Harus Berlaku untuk Semua Lingkup dalam 1 ULOK
-- ============================================================================
-- Date: 2026-07-14
-- Issue: Pertambahan SPK hanya berlaku untuk 1 lingkup (misal SIPIL saja),
--        padahal seharusnya berlaku untuk semua lingkup (SIPIL + ME) dalam
--        1 ULOK yang sama.
-- 
-- Root Cause: Query mencari pertambahan berdasarkan id_spk, bukan nomor_ulok
--
-- Solution: Ubah query agar mencari pertambahan berdasarkan nomor_ulok
--           (cross-lingkup)
-- ============================================================================

-- SCRIPT INI HANYA DOKUMENTASI SQL
-- Fix sebenarnya ada di: sparta-be/src/modules/surat-peringatan/sp.repository.ts

-- ============================================================================
-- BEFORE (Query Lama - SALAH)
-- ============================================================================
/*
LEFT JOIN LATERAL (
    SELECT MAX(parsed_extension_date) AS approved_until
    FROM (
        SELECT
            CASE
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
                    THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
                    THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
                ELSE NULL::date
            END AS parsed_extension_date
        FROM pertambahan_spk pt
        WHERE pt.id_spk = ps.id  -- ❌ HANYA CARI BERDASARKAN SPK INI
          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
    ) parsed
) extension ON TRUE
*/

-- ============================================================================
-- AFTER (Query Baru - BENAR)
-- ============================================================================
/*
LEFT JOIN LATERAL (
    SELECT MAX(parsed_extension_date) AS approved_until
    FROM (
        SELECT
            CASE
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
                    THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
                    THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
                ELSE NULL::date
            END AS parsed_extension_date
        FROM pertambahan_spk pt
        JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
        JOIN toko t_source ON t_source.id = ps_source.id_toko
        WHERE t_source.nomor_ulok = t.nomor_ulok  -- ✅ CARI BERDASARKAN ULOK (CROSS-LINGKUP)
          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
    ) parsed
) extension ON TRUE
*/

-- ============================================================================
-- TEST QUERY
-- ============================================================================
-- Verifikasi bahwa pertambahan SPK SIPIL sekarang juga berlaku untuk ME

WITH test_ulok AS (
    SELECT '2VZ1-2604-0007' AS nomor_ulok
)
SELECT
    t.id AS toko_id,
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    ps.id AS spk_id,
    ps.nomor_spk,
    ps.waktu_selesai AS original_end,
    COALESCE(extension.approved_until, ps.waktu_selesai::date) AS effective_end,
    extension.pertambahan_id,
    extension.source_lingkup,
    CASE 
        WHEN extension.approved_until IS NOT NULL THEN '✅ Punya Extension'
        ELSE '❌ Tidak Ada Extension'
    END AS status
FROM toko t
JOIN test_ulok ON test_ulok.nomor_ulok = t.nomor_ulok
JOIN pengajuan_spk ps ON ps.id_toko = t.id
LEFT JOIN LATERAL (
    SELECT 
        MAX(parsed_extension_date) AS approved_until,
        MAX(pt.id) AS pertambahan_id,
        MAX(t_source.lingkup_pekerjaan) AS source_lingkup
    FROM (
        SELECT
            pt.id,
            CASE
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
                    THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
                WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
                    THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
                ELSE NULL::date
            END AS parsed_extension_date
        FROM pertambahan_spk pt
        JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
        JOIN toko t_source ON t_source.id = ps_source.id_toko
        WHERE t_source.nomor_ulok = t.nomor_ulok
          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
    ) subq
    JOIN pertambahan_spk pt ON pt.id = subq.id
    JOIN pengajuan_spk ps_join ON ps_join.id = pt.id_spk
    JOIN toko t_source ON t_source.id = ps_join.id_toko
) extension ON TRUE
ORDER BY t.lingkup_pekerjaan;

-- Expected Result:
-- toko_id | lingkup | spk_id | effective_end | status
-- --------|---------|--------|---------------|------------------------
-- 1587    | ME      | 327    | 2026-07-15    | ✅ Punya Extension
-- 1575    | SIPIL   | 261    | 2026-07-15    | ✅ Punya Extension
--
-- Keduanya harus punya effective_end yang sama (2026-07-15)
-- meskipun pertambahan SPK hanya dibuat untuk SIPIL
