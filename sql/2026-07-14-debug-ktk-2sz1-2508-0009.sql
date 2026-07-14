-- ========================================================================
-- DEBUG: Investigasi KTK untuk ULOK 2SZ1-2508-0009
-- Mencari penyebab mengapa direktur kontraktor tidak bisa lihat KTK ini
-- ========================================================================

-- 1) CEK DATA TOKO & KONTRAKTOR untuk ULOK 2SZ1-2508-0009
SELECT 
    t.id AS toko_id,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    t.nama_kontraktor,
    t.proyek,
    t.alamat,
    t.created_at AS toko_created_at
FROM toko t
WHERE t.nomor_ulok = '2SZ1-2508-0009';

-- 2) CEK SEMUA OPNAME_FINAL untuk ULOK ini
SELECT 
    ofn.id AS opname_id,
    ofn.id_toko,
    ofn.status_opname_final,
    ofn.aksi,
    ofn.tipe_opname,
    ofn.email_pembuat,
    ofn.grand_total_opname,
    ofn.grand_total_final,
    ofn.hari_denda,
    ofn.nilai_denda,
    ofn.pemberi_persetujuan_koordinator,
    ofn.waktu_persetujuan_koordinator,
    ofn.pemberi_persetujuan_manager,
    ofn.waktu_persetujuan_manager,
    ofn.pemberi_persetujuan_direktur,
    ofn.waktu_persetujuan_direktur,
    ofn.link_pdf_opname,
    ofn.created_at,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    t.nama_kontraktor
FROM opname_final ofn
JOIN toko t ON t.id = ofn.id_toko
WHERE t.nomor_ulok = '2SZ1-2508-0009'
ORDER BY ofn.created_at DESC;

-- 3) CEK APAKAH ADA KTK PENDING DIREKTUR KONTRAKTOR untuk kontraktor ULOK ini
SELECT 
    ofn.id AS opname_id,
    ofn.status_opname_final,
    ofn.aksi,
    ofn.tipe_opname,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    t.nama_kontraktor,
    ofn.grand_total_final,
    ofn.created_at
FROM opname_final ofn
JOIN toko t ON t.id = ofn.id_toko
WHERE t.nama_kontraktor = (
    SELECT nama_kontraktor 
    FROM toko 
    WHERE nomor_ulok = '2SZ1-2508-0009'
    LIMIT 1
)
AND ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
AND ofn.aksi = 'terkunci'
AND ofn.tipe_opname = 'OPNAME_FINAL'
ORDER BY ofn.created_at DESC;

-- 4) CEK USER DIREKTUR KONTRAKTOR yang bisa approve KTK untuk kontraktor ini
SELECT 
    uc.id AS user_id,
    uc.email,
    uc.nama_lengkap,
    uc.jabatan,
    uc.cabang,
    uc.nama_pt,
    uc.roles,
    uc.created_at
FROM user_cabang uc
WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
AND (
    -- Cek apakah nama_pt user match dengan nama_kontraktor di toko
    UPPER(REGEXP_REPLACE(uc.nama_pt, '[^A-Z0-9]', '', 'g')) = 
    UPPER(REGEXP_REPLACE(
        (SELECT nama_kontraktor FROM toko WHERE nomor_ulok = '2SZ1-2508-0009' LIMIT 1),
        '[^A-Z0-9]', '', 'g'
    ))
    OR uc.nama_pt IS NULL  -- Atau user tanpa PT (red flag!)
)
ORDER BY uc.created_at DESC;

-- 5) CEK MISMATCH: Nama PT User vs Nama Kontraktor Toko
-- Ini yang sering jadi masalah!
SELECT 
    uc.email AS user_email,
    uc.nama_lengkap AS user_name,
    uc.nama_pt AS user_company,
    t.nomor_ulok,
    t.nama_toko,
    t.nama_kontraktor AS toko_company,
    -- Normalisasi untuk comparison
    UPPER(REGEXP_REPLACE(uc.nama_pt, '[^A-Z0-9]', '', 'g')) AS user_normalized,
    UPPER(REGEXP_REPLACE(t.nama_kontraktor, '[^A-Z0-9]', '', 'g')) AS toko_normalized,
    -- Hasil match
    CASE 
        WHEN UPPER(REGEXP_REPLACE(uc.nama_pt, '[^A-Z0-9]', '', 'g')) = 
             UPPER(REGEXP_REPLACE(t.nama_kontraktor, '[^A-Z0-9]', '', 'g'))
        THEN 'MATCH ✓'
        ELSE 'MISMATCH ✗'
    END AS match_status
FROM user_cabang uc
CROSS JOIN toko t
WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
AND t.nomor_ulok = '2SZ1-2508-0009'
AND uc.nama_pt IS NOT NULL
ORDER BY match_status, uc.created_at DESC;

-- 6) CEK APAKAH ADA USER DIREKTUR KONTRAKTOR TANPA NAMA_PT (Bug Alert!)
SELECT 
    uc.id,
    uc.email,
    uc.nama_lengkap,
    uc.jabatan,
    uc.cabang,
    uc.nama_pt,
    CASE 
        WHEN uc.nama_pt IS NULL OR TRIM(uc.nama_pt) = '' THEN '🚨 MISSING PT NAME!'
        ELSE '✓ PT Name OK'
    END AS status
FROM user_cabang uc
WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
ORDER BY 
    CASE WHEN uc.nama_pt IS NULL OR TRIM(uc.nama_pt) = '' THEN 0 ELSE 1 END,
    uc.created_at DESC;

-- 7) LIST SEMUA KONTRAKTOR UNIK di sistem (untuk reference)
SELECT DISTINCT
    t.nama_kontraktor,
    t.cabang,
    COUNT(DISTINCT t.nomor_ulok) AS total_ulok,
    COUNT(DISTINCT ofn.id) FILTER (
        WHERE ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
        AND ofn.aksi = 'terkunci'
    ) AS ktk_pending_count
FROM toko t
LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
WHERE t.nama_kontraktor IS NOT NULL
AND TRIM(t.nama_kontraktor) != ''
GROUP BY t.nama_kontraktor, t.cabang
ORDER BY ktk_pending_count DESC, total_ulok DESC
LIMIT 20;

-- 8) FINAL: Get exact data untuk simulasi frontend fetch
-- Ini simulasi API call: GET /api/final_opname?status=Menunggu+Persetujuan+Direktur+Kontraktor
SELECT 
    ofn.id,
    ofn.id_toko,
    ofn.status_opname_final,
    ofn.aksi,
    ofn.tipe_opname,
    ofn.grand_total_final,
    ofn.email_pembuat,
    ofn.created_at,
    t.nomor_ulok,
    t.nama_toko,
    t.cabang,
    t.nama_kontraktor,
    -- Check: apakah ini akan match dengan user.nama_pt?
    UPPER(REGEXP_REPLACE(t.nama_kontraktor, '[^A-Z0-9]', '', 'g')) AS nama_kontraktor_normalized
FROM opname_final ofn
JOIN toko t ON t.id = ofn.id_toko
WHERE ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
AND ofn.aksi = 'terkunci'
AND ofn.tipe_opname = 'OPNAME_FINAL'
AND t.nomor_ulok = '2SZ1-2508-0009'
ORDER BY ofn.created_at DESC;

-- ========================================================================
-- EXPECTED OUTPUT INTERPRETATION:
--
-- Query 1: Harus return 1 row dengan data toko yang lengkap
-- Query 2: Harus return minimal 1 OPNAME_FINAL untuk ULOK ini
-- Query 3: Jika kosong -> berarti tidak ada KTK pending direktur untuk kontraktor ini
-- Query 4: Harus return minimal 1 user direktur kontraktor dengan nama_pt yang match
-- Query 5: Harus show "MATCH ✓" untuk user yang valid
-- Query 6: Jika ada user tanpa nama_pt -> RED FLAG! Bug root cause!
-- Query 7: List all kontraktor untuk cross-reference
-- Query 8: Data yang SEHARUSNYA muncul di frontend approval page
-- ========================================================================
