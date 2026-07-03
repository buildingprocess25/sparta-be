-- ============================================================================
-- Analysis: Identifikasi ULOK dengan Typo SIPIL
-- Tanggal: 2026-07-03
-- Tujuan: Menganalisis data ULOK yang salah masuk ke scope SIPIL
-- ============================================================================

-- Query ini AMAN untuk dijalankan, hanya membaca data, tidak mengubah apapun

-- ============================================================================
-- QUERY 1: ULOK yang punya data di SIPIL DAN ME (potential typo)
-- ============================================================================

SELECT 
    t_sipil.nomor_ulok,
    t_sipil.nama_toko,
    t_sipil.kode_toko,
    t_sipil.cabang,
    t_sipil.id AS id_toko_sipil,
    t_me.id AS id_toko_me,
    
    -- Count data terkait SIPIL
    (SELECT COUNT(*) FROM rab WHERE id_toko = t_sipil.id) AS rab_sipil,
    (SELECT COUNT(*) FROM pengajuan_spk WHERE id_toko = t_sipil.id) AS spk_sipil,
    (SELECT COUNT(*) FROM gantt_chart WHERE id_toko = t_sipil.id) AS gantt_sipil,
    (SELECT COUNT(*) FROM opname_final WHERE id_toko = t_sipil.id) AS opname_sipil,
    (SELECT COUNT(*) FROM instruksi_lapangan WHERE id_toko = t_sipil.id) AS il_sipil,
    (SELECT COUNT(*) FROM berkas_serah_terima WHERE id_toko = t_sipil.id) AS serah_terima_sipil,
    
    -- Count data terkait ME
    (SELECT COUNT(*) FROM rab WHERE id_toko = t_me.id) AS rab_me,
    (SELECT COUNT(*) FROM pengajuan_spk WHERE id_toko = t_me.id) AS spk_me,
    (SELECT COUNT(*) FROM gantt_chart WHERE id_toko = t_me.id) AS gantt_me,
    (SELECT COUNT(*) FROM opname_final WHERE id_toko = t_me.id) AS opname_me,
    (SELECT COUNT(*) FROM instruksi_lapangan WHERE id_toko = t_me.id) AS il_me,
    (SELECT COUNT(*) FROM berkas_serah_terima WHERE id_toko = t_me.id) AS serah_terima_me,
    
    -- Total dokumen
    (SELECT COUNT(*) FROM rab WHERE id_toko = t_sipil.id) +
    (SELECT COUNT(*) FROM pengajuan_spk WHERE id_toko = t_sipil.id) +
    (SELECT COUNT(*) FROM gantt_chart WHERE id_toko = t_sipil.id) +
    (SELECT COUNT(*) FROM opname_final WHERE id_toko = t_sipil.id) +
    (SELECT COUNT(*) FROM instruksi_lapangan WHERE id_toko = t_sipil.id) +
    (SELECT COUNT(*) FROM berkas_serah_terima WHERE id_toko = t_sipil.id) AS total_dokumen_sipil,
    
    (SELECT COUNT(*) FROM rab WHERE id_toko = t_me.id) +
    (SELECT COUNT(*) FROM pengajuan_spk WHERE id_toko = t_me.id) +
    (SELECT COUNT(*) FROM gantt_chart WHERE id_toko = t_me.id) +
    (SELECT COUNT(*) FROM opname_final WHERE id_toko = t_me.id) +
    (SELECT COUNT(*) FROM instruksi_lapangan WHERE id_toko = t_me.id) +
    (SELECT COUNT(*) FROM berkas_serah_terima WHERE id_toko = t_me.id) AS total_dokumen_me
    
FROM toko t_sipil
INNER JOIN toko t_me ON UPPER(TRIM(t_sipil.nomor_ulok)) = UPPER(TRIM(t_me.nomor_ulok))
WHERE t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND t_me.lingkup_pekerjaan = 'ME'
  AND t_sipil.id != t_me.id
ORDER BY t_sipil.nomor_ulok;

-- ============================================================================
-- QUERY 2: Detail RAB untuk ULOK yang bermasalah
-- ============================================================================

SELECT 
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    t.nama_toko,
    r.id AS id_rab,
    r.status AS rab_status,
    r.grand_total AS rab_total,
    r.created_at AS rab_created_at,
    (SELECT COUNT(*) FROM rab_item WHERE id_rab = r.id) AS rab_item_count
FROM toko t
INNER JOIN rab r ON r.id_toko = t.id
WHERE t.nomor_ulok IN (
    SELECT DISTINCT t1.nomor_ulok
    FROM toko t1
    INNER JOIN toko t2 ON UPPER(TRIM(t1.nomor_ulok)) = UPPER(TRIM(t2.nomor_ulok))
    WHERE t1.lingkup_pekerjaan = 'SIPIL'
      AND t2.lingkup_pekerjaan = 'ME'
      AND t1.id != t2.id
)
ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, r.created_at;

-- ============================================================================
-- QUERY 3: Detail SPK untuk ULOK yang bermasalah
-- ============================================================================

SELECT 
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    t.nama_toko,
    ps.id AS id_spk,
    ps.nomor_spk,
    ps.status AS spk_status,
    ps.grand_total AS spk_total,
    ps.waktu_mulai,
    ps.waktu_selesai,
    ps.created_at AS spk_created_at
FROM toko t
INNER JOIN pengajuan_spk ps ON ps.id_toko = t.id
WHERE t.nomor_ulok IN (
    SELECT DISTINCT t1.nomor_ulok
    FROM toko t1
    INNER JOIN toko t2 ON UPPER(TRIM(t1.nomor_ulok)) = UPPER(TRIM(t2.nomor_ulok))
    WHERE t1.lingkup_pekerjaan = 'SIPIL'
      AND t2.lingkup_pekerjaan = 'ME'
      AND t1.id != t2.id
)
ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, ps.created_at;

-- ============================================================================
-- QUERY 4: Detail Opname untuk ULOK yang bermasalah
-- ============================================================================

SELECT 
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    t.nama_toko,
    of.id AS id_opname,
    of.tipe_opname,
    of.grand_total_rab_disetujui,
    of.grand_total_kerja_tambah_disetujui,
    of.grand_total_kerja_kurang_disetujui,
    of.denda_keterlambatan,
    of.total_penagihan,
    of.created_at AS opname_created_at
FROM toko t
INNER JOIN opname_final of ON of.id_toko = t.id
WHERE t.nomor_ulok IN (
    SELECT DISTINCT t1.nomor_ulok
    FROM toko t1
    INNER JOIN toko t2 ON UPPER(TRIM(t1.nomor_ulok)) = UPPER(TRIM(t2.nomor_ulok))
    WHERE t1.lingkup_pekerjaan = 'SIPIL'
      AND t2.lingkup_pekerjaan = 'ME'
      AND t1.id != t2.id
)
ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, of.created_at;

-- ============================================================================
-- QUERY 5: Detail Serah Terima untuk ULOK yang bermasalah
-- ============================================================================

SELECT 
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    t.nama_toko,
    bst.id AS id_serah_terima,
    bst.link_pdf,
    bst.created_at AS serah_terima_created_at
FROM toko t
INNER JOIN berkas_serah_terima bst ON bst.id_toko = t.id
WHERE t.nomor_ulok IN (
    SELECT DISTINCT t1.nomor_ulok
    FROM toko t1
    INNER JOIN toko t2 ON UPPER(TRIM(t1.nomor_ulok)) = UPPER(TRIM(t2.nomor_ulok))
    WHERE t1.lingkup_pekerjaan = 'SIPIL'
      AND t2.lingkup_pekerjaan = 'ME'
      AND t1.id != t2.id
)
ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, bst.created_at;

-- ============================================================================
-- QUERY 6: Summary per cabang
-- ============================================================================

SELECT 
    t_sipil.cabang,
    COUNT(DISTINCT t_sipil.nomor_ulok) AS jumlah_ulok_bermasalah,
    SUM((SELECT COUNT(*) FROM rab WHERE id_toko = t_sipil.id)) AS total_rab_sipil,
    SUM((SELECT COUNT(*) FROM pengajuan_spk WHERE id_toko = t_sipil.id)) AS total_spk_sipil,
    SUM((SELECT COUNT(*) FROM opname_final WHERE id_toko = t_sipil.id)) AS total_opname_sipil
FROM toko t_sipil
INNER JOIN toko t_me ON UPPER(TRIM(t_sipil.nomor_ulok)) = UPPER(TRIM(t_me.nomor_ulok))
WHERE t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND t_me.lingkup_pekerjaan = 'ME'
  AND t_sipil.id != t_me.id
GROUP BY t_sipil.cabang
ORDER BY jumlah_ulok_bermasalah DESC;

-- ============================================================================
-- QUERY 7: Case CIBARENGKOK (BZ01-2602-0003) - Special Check
-- ============================================================================

-- Lihat detail lengkap untuk ULOK yang disebutkan user
SELECT 
    t.id,
    t.nomor_ulok,
    t.lingkup_pekerjaan,
    t.nama_toko,
    t.kode_toko,
    t.cabang,
    t.proyek,
    (SELECT json_agg(json_build_object('id', r.id, 'status', r.status, 'grand_total', r.grand_total)) 
     FROM rab r WHERE r.id_toko = t.id) AS rab_data,
    (SELECT json_agg(json_build_object('id', ps.id, 'nomor_spk', ps.nomor_spk, 'status', ps.status)) 
     FROM pengajuan_spk ps WHERE ps.id_toko = t.id) AS spk_data,
    (SELECT json_agg(json_build_object('id', of.id, 'tipe', of.tipe_opname, 'denda', of.denda_keterlambatan)) 
     FROM opname_final of WHERE of.id_toko = t.id) AS opname_data
FROM toko t
WHERE UPPER(TRIM(t.nomor_ulok)) = UPPER('BZ01-2602-0003')
ORDER BY t.lingkup_pekerjaan;

-- ============================================================================
-- QUERY 8: List semua ULOK yang perlu di-merge (untuk konfirmasi)
-- ============================================================================

SELECT 
    ROW_NUMBER() OVER (ORDER BY t_sipil.nomor_ulok) AS no,
    t_sipil.nomor_ulok,
    t_sipil.nama_toko,
    t_sipil.cabang,
    'SIPIL → ME' AS merge_direction,
    t_sipil.id AS from_id_toko,
    t_me.id AS to_id_toko
FROM toko t_sipil
INNER JOIN toko t_me ON UPPER(TRIM(t_sipil.nomor_ulok)) = UPPER(TRIM(t_me.nomor_ulok))
WHERE t_sipil.lingkup_pekerjaan = 'SIPIL'
  AND t_me.lingkup_pekerjaan = 'ME'
  AND t_sipil.id != t_me.id
ORDER BY t_sipil.nomor_ulok;

-- ============================================================================
-- QUERY 9: Check potential conflicts (same ULOK, same scope duplicate)
-- ============================================================================

-- Cek apakah ada ULOK yang duplicate di scope yang sama (seharusnya tidak ada)
SELECT 
    nomor_ulok,
    lingkup_pekerjaan,
    COUNT(*) AS duplicate_count,
    STRING_AGG(id::text, ', ' ORDER BY id) AS id_list
FROM toko
GROUP BY UPPER(TRIM(nomor_ulok)), lingkup_pekerjaan
HAVING COUNT(*) > 1
ORDER BY nomor_ulok, lingkup_pekerjaan;
