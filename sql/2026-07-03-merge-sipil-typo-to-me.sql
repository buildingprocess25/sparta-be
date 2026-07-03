-- ============================================================================
-- Migration: Merge ULOK dengan Typo SIPIL ke ME
-- Tanggal: 2026-07-03
-- Tujuan: Menggabungkan data ULOK yang salah masuk ke scope SIPIL (typo)
--         ke scope ME yang benar, termasuk semua relasi (RAB, SPK, Opname, dll)
-- ============================================================================

-- CRITICAL NOTE: 
-- Backup database sebelum menjalankan script ini!
-- Script ini akan melakukan:
-- 1. Identifikasi ULOK yang punya data di SIPIL dan ME (possible typo)
-- 2. Merge data dari toko SIPIL ke toko ME
-- 3. Update semua foreign key references
-- 4. Hapus toko dengan scope SIPIL yang sudah di-merge

BEGIN;

-- ============================================================================
-- STEP 1: IDENTIFIKASI ULOK YANG BERMASALAH
-- ============================================================================

-- Tampilkan ULOK yang punya data di SIPIL dan ME
-- User perlu review manual untuk confirm mana yang typo
SELECT 
    t1.nomor_ulok,
    t1.id AS id_sipil,
    t1.nama_toko AS nama_sipil,
    t2.id AS id_me,
    t2.nama_toko AS nama_me,
    (SELECT COUNT(*) FROM rab WHERE id_toko = t1.id) AS rab_sipil_count,
    (SELECT COUNT(*) FROM rab WHERE id_toko = t2.id) AS rab_me_count,
    (SELECT COUNT(*) FROM pengajuan_spk WHERE id_toko = t1.id) AS spk_sipil_count,
    (SELECT COUNT(*) FROM pengajuan_spk WHERE id_toko = t2.id) AS spk_me_count,
    (SELECT COUNT(*) FROM opname_final WHERE id_toko = t1.id) AS opname_sipil_count,
    (SELECT COUNT(*) FROM opname_final WHERE id_toko = t2.id) AS opname_me_count
FROM toko t1
INNER JOIN toko t2 ON UPPER(TRIM(t1.nomor_ulok)) = UPPER(TRIM(t2.nomor_ulok))
WHERE t1.lingkup_pekerjaan = 'SIPIL'
  AND t2.lingkup_pekerjaan = 'ME'
  AND t1.id != t2.id
ORDER BY t1.nomor_ulok;

-- ============================================================================
-- STEP 2: CREATE TEMPORARY TABLE UNTUK MAPPING
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS ulok_merge_mapping AS
SELECT 
    t1.id AS id_sipil,
    t2.id AS id_me,
    t1.nomor_ulok,
    t1.nama_toko
FROM toko t1
INNER JOIN toko t2 ON UPPER(TRIM(t1.nomor_ulok)) = UPPER(TRIM(t2.nomor_ulok))
WHERE t1.lingkup_pekerjaan = 'SIPIL'
  AND t2.lingkup_pekerjaan = 'ME'
  AND t1.id != t2.id;

-- Tampilkan mapping yang akan di-merge
SELECT * FROM ulok_merge_mapping ORDER BY nomor_ulok;

-- ============================================================================
-- STEP 3: UPDATE FOREIGN KEYS - RAB
-- ============================================================================

-- Update RAB yang menggunakan id_toko SIPIL ke ME
UPDATE rab
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE rab.id_toko = m.id_sipil;

-- Log hasil
SELECT 'RAB updated' AS action, COUNT(*) AS count
FROM rab r
INNER JOIN ulok_merge_mapping m ON r.id_toko = m.id_me;

-- ============================================================================
-- STEP 4: UPDATE FOREIGN KEYS - PENGAJUAN SPK
-- ============================================================================

-- Update SPK yang menggunakan id_toko SIPIL ke ME
UPDATE pengajuan_spk
SET 
    id_toko = m.id_me,
    lingkup_pekerjaan = 'ME'
FROM ulok_merge_mapping m
WHERE pengajuan_spk.id_toko = m.id_sipil;

-- Log hasil
SELECT 'SPK updated' AS action, COUNT(*) AS count
FROM pengajuan_spk ps
INNER JOIN ulok_merge_mapping m ON ps.id_toko = m.id_me;

-- ============================================================================
-- STEP 5: UPDATE FOREIGN KEYS - GANTT CHART
-- ============================================================================

-- Update Gantt Chart
UPDATE gantt_chart
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE gantt_chart.id_toko = m.id_sipil;

-- Log hasil
SELECT 'Gantt Chart updated' AS action, COUNT(*) AS count
FROM gantt_chart gc
INNER JOIN ulok_merge_mapping m ON gc.id_toko = m.id_me;

-- ============================================================================
-- STEP 6: UPDATE FOREIGN KEYS - INSTRUKSI LAPANGAN
-- ============================================================================

-- Update Instruksi Lapangan
UPDATE instruksi_lapangan
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE instruksi_lapangan.id_toko = m.id_sipil;

-- Log hasil
SELECT 'Instruksi Lapangan updated' AS action, COUNT(*) AS count
FROM instruksi_lapangan il
INNER JOIN ulok_merge_mapping m ON il.id_toko = m.id_me;

-- ============================================================================
-- STEP 7: UPDATE FOREIGN KEYS - OPNAME FINAL
-- ============================================================================

-- Update Opname Final
UPDATE opname_final
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE opname_final.id_toko = m.id_sipil;

-- Log hasil
SELECT 'Opname Final updated' AS action, COUNT(*) AS count
FROM opname_final of
INNER JOIN ulok_merge_mapping m ON of.id_toko = m.id_me;

-- ============================================================================
-- STEP 8: UPDATE FOREIGN KEYS - BERKAS SERAH TERIMA
-- ============================================================================

-- Update Berkas Serah Terima
UPDATE berkas_serah_terima
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE berkas_serah_terima.id_toko = m.id_sipil;

-- Log hasil
SELECT 'Berkas Serah Terima updated' AS action, COUNT(*) AS count
FROM berkas_serah_terima bst
INNER JOIN ulok_merge_mapping m ON bst.id_toko = m.id_me;

-- ============================================================================
-- STEP 9: UPDATE FOREIGN KEYS - PIC PENGAWASAN
-- ============================================================================

-- Update PIC Pengawasan
UPDATE pic_pengawasan
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE pic_pengawasan.id_toko = m.id_sipil;

-- Log hasil
SELECT 'PIC Pengawasan updated' AS action, COUNT(*) AS count
FROM pic_pengawasan pp
INNER JOIN ulok_merge_mapping m ON pp.id_toko = m.id_me;

-- ============================================================================
-- STEP 10: UPDATE FOREIGN KEYS - PENGAWASAN GANTT
-- ============================================================================

-- Update Pengawasan Gantt
UPDATE pengawasan_gantt
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE pengawasan_gantt.id_toko = m.id_sipil;

-- Log hasil
SELECT 'Pengawasan Gantt updated' AS action, COUNT(*) AS count
FROM pengawasan_gantt pg
INNER JOIN ulok_merge_mapping m ON pg.id_toko = m.id_me;

-- ============================================================================
-- STEP 11: UPDATE FOREIGN KEYS - PENYIMPANAN DOKUMEN
-- ============================================================================

-- Update Penyimpanan Dokumen
UPDATE penyimpanan_dokumen
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE penyimpanan_dokumen.id_toko = m.id_sipil;

-- Log hasil
SELECT 'Penyimpanan Dokumen updated' AS action, COUNT(*) AS count
FROM penyimpanan_dokumen pd
INNER JOIN ulok_merge_mapping m ON pd.id_toko = m.id_me;

-- ============================================================================
-- STEP 12: UPDATE FOREIGN KEYS - PROJEK PLANNING
-- ============================================================================

-- Update Projek Planning (jika ada relasi ke toko)
UPDATE projek_planning
SET id_toko = m.id_me
FROM ulok_merge_mapping m
WHERE projek_planning.id_toko = m.id_sipil;

-- Log hasil
SELECT 'Projek Planning updated' AS action, COUNT(*) AS count
FROM projek_planning pp
INNER JOIN ulok_merge_mapping m ON pp.id_toko = m.id_me;

-- ============================================================================
-- STEP 13: VERIFY - CEK APAKAH MASIH ADA DATA YANG MEREFERENSI SIPIL
-- ============================================================================

-- Harus return 0 untuk semua query berikut sebelum melanjutkan ke STEP 14
SELECT 'RAB still referencing SIPIL' AS issue, COUNT(*) AS count
FROM rab r
INNER JOIN ulok_merge_mapping m ON r.id_toko = m.id_sipil;

SELECT 'SPK still referencing SIPIL' AS issue, COUNT(*) AS count
FROM pengajuan_spk ps
INNER JOIN ulok_merge_mapping m ON ps.id_toko = m.id_sipil;

SELECT 'Gantt still referencing SIPIL' AS issue, COUNT(*) AS count
FROM gantt_chart gc
INNER JOIN ulok_merge_mapping m ON gc.id_toko = m.id_sipil;

SELECT 'Instruksi Lapangan still referencing SIPIL' AS issue, COUNT(*) AS count
FROM instruksi_lapangan il
INNER JOIN ulok_merge_mapping m ON il.id_toko = m.id_sipil;

SELECT 'Opname still referencing SIPIL' AS issue, COUNT(*) AS count
FROM opname_final of
INNER JOIN ulok_merge_mapping m ON of.id_toko = m.id_sipil;

SELECT 'Serah Terima still referencing SIPIL' AS issue, COUNT(*) AS count
FROM berkas_serah_terima bst
INNER JOIN ulok_merge_mapping m ON bst.id_toko = m.id_sipil;

SELECT 'PIC Pengawasan still referencing SIPIL' AS issue, COUNT(*) AS count
FROM pic_pengawasan pp
INNER JOIN ulok_merge_mapping m ON pp.id_toko = m.id_sipil;

SELECT 'Pengawasan Gantt still referencing SIPIL' AS issue, COUNT(*) AS count
FROM pengawasan_gantt pg
INNER JOIN ulok_merge_mapping m ON pg.id_toko = m.id_sipil;

SELECT 'Penyimpanan Dokumen still referencing SIPIL' AS issue, COUNT(*) AS count
FROM penyimpanan_dokumen pd
INNER JOIN ulok_merge_mapping m ON pd.id_toko = m.id_sipil;

-- ============================================================================
-- STEP 14: HAPUS RECORD TOKO DENGAN SCOPE SIPIL (YANG SUDAH DI-MERGE)
-- ============================================================================

-- CRITICAL: Hanya jalankan ini setelah memverifikasi STEP 13 semua return 0

DELETE FROM toko
WHERE id IN (SELECT id_sipil FROM ulok_merge_mapping);

-- Log hasil
SELECT 'Toko SIPIL deleted' AS action, COUNT(*) AS count
FROM ulok_merge_mapping;

-- ============================================================================
-- STEP 15: FINAL VERIFICATION
-- ============================================================================

-- Tampilkan ULOK yang masih punya duplicate SIPIL dan ME (seharusnya kosong)
SELECT 
    t1.nomor_ulok,
    COUNT(*) AS duplicate_count
FROM toko t1
GROUP BY UPPER(TRIM(t1.nomor_ulok))
HAVING COUNT(*) > 1;

-- Tampilkan summary data setelah merge
SELECT 
    lingkup_pekerjaan,
    COUNT(*) AS jumlah_toko,
    COUNT(DISTINCT nomor_ulok) AS jumlah_ulok_unik
FROM toko
GROUP BY lingkup_pekerjaan
ORDER BY lingkup_pekerjaan;

-- ============================================================================
-- COMMIT ATAU ROLLBACK
-- ============================================================================

-- Jika semua verification passed, uncomment COMMIT di bawah
-- Jika ada masalah, uncomment ROLLBACK

-- COMMIT;
ROLLBACK;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Script ini akan merge SEMUA ULOK yang punya duplicate di SIPIL dan ME
-- 2. Assumption: Data di ME adalah yang benar, data di SIPIL adalah typo
-- 3. Jika ada case khusus yang memang benar-benar perlu 2 scope terpisah,
--    modify query di STEP 2 untuk exclude ULOK tersebut
-- 4. Backup database WAJIB sebelum run script ini
-- 5. Review hasil STEP 1 dulu sebelum melanjutkan
-- 6. Jalankan dengan hati-hati, step by step jika perlu
-- ============================================================================
