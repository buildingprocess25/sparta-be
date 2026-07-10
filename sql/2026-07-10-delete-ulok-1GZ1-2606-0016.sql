-- ============================================================
-- Migration: Hapus ULOK 1GZ1-2606-0016 (BANGUN JAYA) dan Semua Data Terkait
-- Date: 2026-07-10
-- Author: Database Administrator
-- ============================================================
-- ULOK: 1GZ1-2606-0016
-- Toko: BANGUN JAYA (JL. BANGUN JAYA, KAB. SUKAMARA, KALIMANTAN TENGAH)
-- Cabang: BANJARMASIN
-- Kontraktor: CV HANA KARYA
--
-- Scope:
-- - Menghapus 2 entries toko (SIPIL id=2548, ME id=2553)
-- - Menghapus 2 RAB (id=2355 SIPIL, id=2360 ME)
-- - Semua data terkait akan terhapus otomatis via CASCADE DELETE
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: PREVIEW DATA YANG AKAN DIHAPUS
-- ============================================================
-- Jalankan query ini terlebih dahulu untuk verifikasi sebelum commit
-- Pastikan data yang ditampilkan adalah data yang benar akan dihapus

SELECT '=== TOKO YANG AKAN DIHAPUS ===' AS info;
SELECT 
    id AS id_toko,
    nomor_ulok,
    lingkup_pekerjaan,
    nama_toko,
    kode_toko,
    cabang,
    alamat,
    nama_kontraktor,
    proyek
FROM toko
WHERE nomor_ulok = '1GZ1-2606-0016'
ORDER BY id;

SELECT '=== RAB YANG AKAN DIHAPUS (CASCADE) ===' AS info;
SELECT 
    r.id AS id_rab,
    r.id_toko,
    r.no_sph,
    r.status,
    r.nama_pt,
    r.grand_total,
    r.grand_total_non_sbo,
    r.grand_total_final,
    r.email_pembuat,
    r.created_at
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE t.nomor_ulok = '1GZ1-2606-0016'
ORDER BY r.id;

SELECT '=== RAB ITEMS YANG AKAN DIHAPUS (CASCADE) ===' AS info;
SELECT 
    ri.id AS id_rab_item,
    ri.id_rab,
    ri.kategori_pekerjaan,
    ri.jenis_pekerjaan,
    ri.volume,
    ri.satuan,
    ri.harga_satuan,
    ri.total_harga
FROM rab_item ri
JOIN rab r ON r.id = ri.id_rab
JOIN toko t ON t.id = r.id_toko
WHERE t.nomor_ulok = '1GZ1-2606-0016'
ORDER BY ri.id
LIMIT 100; -- Limit untuk menghindari output terlalu banyak

SELECT '=== GANTT CHART YANG AKAN DIHAPUS (CASCADE) ===' AS info;
SELECT 
    g.id AS id_gantt,
    g.id_toko,
    g.nomor_ulok,
    g.status,
    g.created_at,
    g.updated_at
FROM gantt_chart g
JOIN toko t ON t.id = g.id_toko
WHERE t.nomor_ulok = '1GZ1-2606-0016'
ORDER BY g.id;

SELECT '=== PENGAJUAN SPK YANG AKAN DIHAPUS (CASCADE) ===' AS info;
SELECT 
    ps.id AS id_spk,
    ps.id_toko,
    ps.nomor_ulok,
    ps.tanggal_pengajuan,
    ps.status
FROM pengajuan_spk ps
WHERE ps.nomor_ulok = '1GZ1-2606-0016'
ORDER BY ps.id;

SELECT '=== OPNAME YANG AKAN DIHAPUS (CASCADE) ===' AS info;
SELECT 
    o.id AS id_opname,
    o.id_toko,
    o.nomor_ulok,
    o.tanggal_opname,
    o.status
FROM opname_final o
WHERE o.nomor_ulok = '1GZ1-2606-0016'
ORDER BY o.id;

-- ============================================================
-- STEP 2: COUNT SUMMARY
-- ============================================================
SELECT '=== RINGKASAN JUMLAH DATA YANG AKAN DIHAPUS ===' AS info;

WITH deletion_summary AS (
    SELECT 'Toko' AS tabel, COUNT(*) AS jumlah
    FROM toko WHERE nomor_ulok = '1GZ1-2606-0016'
    
    UNION ALL
    
    SELECT 'RAB' AS tabel, COUNT(*) AS jumlah
    FROM rab r
    JOIN toko t ON t.id = r.id_toko
    WHERE t.nomor_ulok = '1GZ1-2606-0016'
    
    UNION ALL
    
    SELECT 'RAB Items' AS tabel, COUNT(*) AS jumlah
    FROM rab_item ri
    JOIN rab r ON r.id = ri.id_rab
    JOIN toko t ON t.id = r.id_toko
    WHERE t.nomor_ulok = '1GZ1-2606-0016'
    
    UNION ALL
    
    SELECT 'Gantt Chart' AS tabel, COUNT(*) AS jumlah
    FROM gantt_chart g
    JOIN toko t ON t.id = g.id_toko
    WHERE t.nomor_ulok = '1GZ1-2606-0016'
    
    UNION ALL
    
    SELECT 'Pengajuan SPK' AS tabel, COUNT(*) AS jumlah
    FROM pengajuan_spk ps
    WHERE ps.nomor_ulok = '1GZ1-2606-0016'
    
    UNION ALL
    
    SELECT 'Opname Final' AS tabel, COUNT(*) AS jumlah
    FROM opname_final o
    WHERE o.nomor_ulok = '1GZ1-2606-0016'
)
SELECT * FROM deletion_summary ORDER BY tabel;

-- ============================================================
-- STEP 3: BACKUP DATA KE TABEL TEMPORARY (OPTIONAL SAFETY)
-- ============================================================
-- Membuat backup sementara sebelum menghapus
-- Bisa di-restore jika terjadi kesalahan

-- Backup toko
CREATE TEMP TABLE IF NOT EXISTS _backup_toko_deleted AS
SELECT *, now() AS deleted_at
FROM toko
WHERE nomor_ulok = '1GZ1-2606-0016';

-- Backup rab
CREATE TEMP TABLE IF NOT EXISTS _backup_rab_deleted AS
SELECT r.*, now() AS deleted_at
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE t.nomor_ulok = '1GZ1-2606-0016';

-- Backup rab_item
CREATE TEMP TABLE IF NOT EXISTS _backup_rab_item_deleted AS
SELECT ri.*, now() AS deleted_at
FROM rab_item ri
JOIN rab r ON r.id = ri.id_rab
JOIN toko t ON t.id = r.id_toko
WHERE t.nomor_ulok = '1GZ1-2606-0016';

SELECT '=== BACKUP SELESAI ===' AS info;
SELECT 'Data telah di-backup ke tabel temporary' AS status;
SELECT 'Gunakan ROLLBACK untuk membatalkan penghapusan' AS catatan;

-- ============================================================
-- STEP 4: DELETE DATA (AUTOMATIC CASCADE)
-- ============================================================
-- PERHATIAN: DELETE ini akan menghapus:
-- 1. Toko (2 records)
-- 2. RAB dan semua items (CASCADE)
-- 3. Gantt chart dan semua dependencies (CASCADE)
-- 4. SPK jika ada (CASCADE)
-- 5. Opname jika ada (CASCADE)

DELETE FROM toko
WHERE nomor_ulok = '1GZ1-2606-0016';

-- Cek hasil penghapusan
SELECT '=== HASIL PENGHAPUSAN ===' AS info;
SELECT 
    (SELECT COUNT(*) FROM _backup_toko_deleted) AS toko_dihapus,
    (SELECT COUNT(*) FROM _backup_rab_deleted) AS rab_dihapus,
    (SELECT COUNT(*) FROM _backup_rab_item_deleted) AS rab_items_dihapus;

-- Verifikasi data sudah tidak ada
SELECT '=== VERIFIKASI DATA SUDAH TERHAPUS ===' AS info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM toko WHERE nomor_ulok = '1GZ1-2606-0016')
        THEN 'GAGAL - Data masih ada!'
        ELSE 'SUKSES - Data sudah terhapus'
    END AS status_penghapusan;

-- ============================================================
-- STEP 5: COMMIT ATAU ROLLBACK
-- ============================================================
-- Jika hasil penghapusan BENAR, jalankan: COMMIT;
-- Jika ada kesalahan, jalankan: ROLLBACK;

-- COMMIT; -- Uncomment untuk finalize penghapusan
-- ROLLBACK; -- Uncomment untuk membatalkan penghapusan

-- ============================================================
-- CATATAN PENTING:
-- ============================================================
-- 1. Script ini menggunakan TRANSACTION (BEGIN...COMMIT)
-- 2. Tidak ada perubahan permanen sampai COMMIT dijalankan
-- 3. Semua CASCADE DELETE otomatis menghapus data terkait
-- 4. Backup temporary tersedia selama session database aktif
-- 5. Pastikan review output STEP 1 dan STEP 2 sebelum COMMIT
-- ============================================================
