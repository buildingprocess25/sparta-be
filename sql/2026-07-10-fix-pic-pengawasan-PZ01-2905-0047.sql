-- ============================================================================
-- FIX: PZ01-2905-0047 - Gantt Chart Incomplete (Hanya H29-H35)
-- ============================================================================
-- Issue: Durasi SPK 35 hari, tapi Gantt Chart hanya tampil H29-H35 (7 hari terakhir)
-- Expected: Gantt Chart lengkap H1-H35 dengan semua kategori pekerjaan
--
-- Root Cause (dari diagnosis database):
-- 1. Gantt Chart hanya punya 2 kategori (INSTALASI & FIXTURE)
--    Padahal RAB punya 3 kategori (+ PEKERJAAN TAMBAHAN)
-- 2. Day items hanya 2:
--    - INSTALASI: H29-H35
--    - FIXTURE: H32-H35
-- 3. Gantt Chart TIDAK MULAI dari H1, tapi dari H29!
-- 4. Ini menyebabkan tampilan PIC Pengawasan hanya menampilkan 7 hari
--
-- Date: 2026-07-10
-- Author: Kiro AI
-- ============================================================================

-- STEP 1: Diagnosis - Cek data saat ini
-- Hasil dari script diagnose-PZ01-2905-0047.ts:
-- ✓ Toko ID: 1881
-- ✓ RAB ID: 1177 (Status: Disetujui, Kategori: NON RUKO, Durasi: 35 hari)
-- ✓ SPK ID: 299 (Durasi: 35 hari, H1: 05/06/2026, H35: 09/07/2026)
-- ✓ Gantt ID: 545 (Status: terkunci)
-- ❌ MASALAH: Gantt Chart hanya 2 kategori, day items hanya H29-H35
--
-- Cek detail Gantt Chart:
SELECT 
    g.id AS gantt_id,
    g.status AS gantt_status,
    COUNT(DISTINCT kp.id) AS jumlah_kategori,
    COUNT(DISTINCT dg.id) AS jumlah_day_items,
    array_agg(DISTINCT kp.kategori_pekerjaan ORDER BY kp.kategori_pekerjaan) AS kategori_list,
    MIN((dg.h_awal)::int) AS h_awal_min,
    MAX((dg.h_akhir)::int) AS h_akhir_max
FROM gantt_chart g
LEFT JOIN kategori_pekerjaan_gantt kp ON kp.id_gantt = g.id
LEFT JOIN day_gantt_chart dg ON dg.id_gantt = g.id
WHERE g.id_toko = 1881
GROUP BY g.id, g.status;

-- STEP 2: Cek kategori pekerjaan dari RAB
SELECT 
    ri.id,
    ri.kategori_pekerjaan,
    COUNT(*) OVER (PARTITION BY ri.kategori_pekerjaan) AS jumlah_items
FROM rab_item ri
WHERE ri.id_rab = 1177
ORDER BY ri.kategori_pekerjaan, ri.id;

-- Expected: 
-- INSTALASI (13 items)
-- FIXTURE (12 items)
-- PEKERJAAN TAMBAHAN (2 items)

-- STEP 3: Cek day items yang sudah ada di Gantt
SELECT 
    dg.id,
    kp.kategori_pekerjaan,
    dg.h_awal,
    dg.h_akhir,
    dg.keterlambatan,
    dg.kecepatan
FROM day_gantt_chart dg
JOIN kategori_pekerjaan_gantt kp ON kp.id = dg.id_kategori_pekerjaan_gantt
WHERE dg.id_gantt = 545
ORDER BY dg.h_awal::int;

-- ============================================================================
-- STEP 4: FIX GANTT CHART - Tambah Kategori & Day Items yang Hilang
-- ============================================================================

-- CATATAN: Gantt Chart sudah status "terkunci", kita perlu unlock dulu
-- WARNING: Ini akan mengubah Gantt Chart yang sudah approved!
-- Pastikan koordinasi dengan kontraktor terlebih dahulu!

BEGIN;

-- 1. Unlock Gantt Chart (agar bisa diedit)
UPDATE gantt_chart
SET status = 'active' -- atau NULL
WHERE id = 545;

-- 2. Tambah kategori "PEKERJAAN TAMBAHAN" yang hilang
INSERT INTO kategori_pekerjaan_gantt (id_gantt, kategori_pekerjaan)
SELECT 545, 'PEKERJAAN TAMBAHAN'
WHERE NOT EXISTS (
    SELECT 1 FROM kategori_pekerjaan_gantt 
    WHERE id_gantt = 545 AND kategori_pekerjaan = 'PEKERJAAN TAMBAHAN'
)
RETURNING id;

-- Expected: Akan return ID kategori baru (misal: 1234)

-- 3. Update day items yang sudah ada agar mulai dari H1
-- INSTALASI: dari H29-H35 → H1-H30
UPDATE day_gantt_chart
SET 
    h_awal = '1',
    h_akhir = '30'
WHERE id_gantt = 545
  AND id_kategori_pekerjaan_gantt = (
      SELECT id FROM kategori_pekerjaan_gantt 
      WHERE id_gantt = 545 AND kategori_pekerjaan = 'INSTALASI'
  );

-- FIXTURE: dari H32-H35 → H25-H35
UPDATE day_gantt_chart
SET 
    h_awal = '25',
    h_akhir = '35'
WHERE id_gantt = 545
  AND id_kategori_pekerjaan_gantt = (
      SELECT id FROM kategori_pekerjaan_gantt 
      WHERE id_gantt = 545 AND kategori_pekerjaan = 'FIXTURE'
  );

-- 4. Tambah day item untuk "PEKERJAAN TAMBAHAN"
-- PEKERJAAN TAMBAHAN: H1-H10 (contoh, sesuaikan dengan kebutuhan)
INSERT INTO day_gantt_chart (
    id_gantt, 
    id_kategori_pekerjaan_gantt, 
    h_awal, 
    h_akhir,
    keterlambatan,
    kecepatan
)
SELECT 
    545,
    kp.id,
    '1',
    '10',
    NULL,
    NULL
FROM kategori_pekerjaan_gantt kp
WHERE kp.id_gantt = 545
  AND kp.kategori_pekerjaan = 'PEKERJAAN TAMBAHAN'
  AND NOT EXISTS (
      SELECT 1 FROM day_gantt_chart dg
      WHERE dg.id_gantt = 545 
        AND dg.id_kategori_pekerjaan_gantt = kp.id
  );

-- 5. Lock kembali Gantt Chart
UPDATE gantt_chart
SET status = 'terkunci'
WHERE id = 545;

-- Verify perubahan
SELECT 
    'AFTER FIX' AS status,
    g.id AS gantt_id,
    g.status AS gantt_status,
    COUNT(DISTINCT kp.id) AS jumlah_kategori,
    COUNT(DISTINCT dg.id) AS jumlah_day_items,
    array_agg(DISTINCT kp.kategori_pekerjaan ORDER BY kp.kategori_pekerjaan) AS kategori_list,
    MIN((dg.h_awal)::int) AS h_awal_min,
    MAX((dg.h_akhir)::int) AS h_akhir_max
FROM gantt_chart g
LEFT JOIN kategori_pekerjaan_gantt kp ON kp.id_gantt = g.id
LEFT JOIN day_gantt_chart dg ON dg.id_gantt = g.id
WHERE g.id = 545
GROUP BY g.id, g.status;

-- Expected:
-- jumlah_kategori = 3
-- jumlah_day_items = 3
-- h_awal_min = 1
-- h_akhir_max = 35

COMMIT;
-- ROLLBACK; -- Uncomment jika ada error atau ingin cancel

-- ============================================================================
-- STEP 5: Generate Jadwal Pengawasan (8 Hari untuk Non-Ruko)
-- ============================================================================

-- CATATAN:
-- Jadwal pengawasan akan dibuat otomatis dari frontend saat user input PIC
-- Tapi jika perlu generate manual, gunakan script ini:

-- Untuk durasi 35 hari Non-Ruko, kita generate 8 tanggal pengawasan:
-- H1, H5, H10, H15, H20, H25, H30, H35
-- SPK Mulai: 05/06/2026, maka:
-- H1  = 05/06/2026
-- H5  = 09/06/2026
-- H10 = 14/06/2026
-- H15 = 19/06/2026
-- H20 = 24/06/2026
-- H25 = 29/06/2026
-- H30 = 04/07/2026
-- H35 = 09/07/2026

/*
BEGIN;

-- Generate 8 tanggal pengawasan
WITH tanggal_list AS (
    SELECT unnest(ARRAY[
        '05/06/2026', -- H1
        '09/06/2026', -- H5
        '14/06/2026', -- H10
        '19/06/2026', -- H15
        '24/06/2026', -- H20
        '29/06/2026', -- H25
        '04/07/2026', -- H30
        '09/07/2026'  -- H35
    ]) AS tanggal_pengawasan
)
INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
SELECT 
    545 AS id_gantt,
    tl.tanggal_pengawasan
FROM tanggal_list tl
WHERE NOT EXISTS (
    SELECT 1 FROM pengawasan_gantt pg
    WHERE pg.id_gantt = 545 
      AND pg.tanggal_pengawasan = tl.tanggal_pengawasan
);

-- Verify
SELECT 
    COUNT(*) AS jumlah_tanggal,
    array_agg(pg.tanggal_pengawasan ORDER BY to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY')) AS list_tanggal
FROM pengawasan_gantt pg
WHERE pg.id_gantt = 545;

-- Expected: jumlah_tanggal = 8

COMMIT;
-- ROLLBACK;
*/

-- ============================================================================
-- NOTES & CARA PENGGUNAAN
-- ============================================================================

-- OPTION 1: Manual SQL Fix (Gunakan script di atas)
-- 1. Review STEP 1, 2, 3 untuk memahami kondisi data
-- 2. UNCOMMENT STEP 4 untuk fix Gantt Chart
-- 3. UNCOMMENT STEP 5 jika ingin generate jadwal pengawasan manual
-- 4. Jalankan dengan hati-hati (sudah ada ROLLBACK jika error)

-- OPTION 2: Kontraktor Buat Ulang (REKOMENDASI)
-- 1. Login sebagai kontraktor (cv.kingkonstruksiutama2015@gmail.com)
-- 2. Menu "Gantt Chart" → Cari ULOK PZ01-2905-0047 ME
-- 3. Edit Gantt Chart yang sudah ada
-- 4. Pastikan:
--    - Ada 3 kategori: INSTALASI, FIXTURE, PEKERJAAN TAMBAHAN
--    - Day items lengkap dari H1-H35
--    - Contoh jadwal:
--      PEKERJAAN TAMBAHAN: H1-H10
--      INSTALASI:          H1-H30
--      FIXTURE:            H25-H35
-- 5. Submit Gantt Chart
-- 6. Setelah Gantt Chart lengkap, baru bisa input PIC Pengawasan

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================

-- Setelah fix (verifikasi dengan query ini):
SELECT 
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    g.id AS gantt_id,
    g.status AS gantt_status,
    COUNT(DISTINCT kp.id) AS jumlah_kategori,
    COUNT(DISTINCT dg.id) AS jumlah_day_items,
    MIN((dg.h_awal)::int) AS h_awal_min,
    MAX((dg.h_akhir)::int) AS h_akhir_max,
    COUNT(DISTINCT pg.id) AS jumlah_tanggal_pengawasan
FROM toko t
JOIN gantt_chart g ON g.id_toko = t.id
LEFT JOIN kategori_pekerjaan_gantt kp ON kp.id_gantt = g.id
LEFT JOIN day_gantt_chart dg ON dg.id_gantt = g.id
LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = g.id
WHERE t.nomor_ulok = 'PZ01-2905-0047'
  AND t.lingkup_pekerjaan = 'ME'
GROUP BY t.nomor_ulok, t.lingkup_pekerjaan, g.id, g.status;

-- Expected Result:
-- jumlah_kategori = 3 (INSTALASI, FIXTURE, PEKERJAAN TAMBAHAN)
-- jumlah_day_items = 3
-- h_awal_min = 1 (mulai dari H1)
-- h_akhir_max = 35 (sampai H35)
-- jumlah_tanggal_pengawasan = 8 (untuk Non-Ruko)

-- Setelah fix, di frontend:
-- ✓ Gantt Chart menampilkan 35 hari lengkap (H1-H35)
-- ✓ Gantt Chart punya 3 kategori pekerjaan
-- ✓ Halaman PIC Pengawasan bisa pilih 8 hari pengawasan
-- ✓ User bisa input pengawasan tanpa error

