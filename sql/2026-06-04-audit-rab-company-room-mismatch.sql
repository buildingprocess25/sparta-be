-- Audit RAB rows that may be "salah masuk kamar".
-- This file is read-only by design: run each SELECT to review candidates before
-- applying any manual data correction.

-- 1) RAB pending direktur kontraktor that can be hidden if the old UI filters by nama_pt.
SELECT
    r.id AS rab_id,
    t.nomor_ulok,
    r.status,
    t.cabang,
    t.lingkup_pekerjaan,
    r.nama_pt AS rab_nama_pt,
    t.nama_kontraktor AS toko_nama_kontraktor,
    r.email_pembuat,
    r.created_at
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE UPPER(r.status) LIKE '%DIREKTUR%KONTRAKTOR%'
  AND (
      NULLIF(BTRIM(r.nama_pt), '') IS NULL
      OR BTRIM(r.nama_pt) = '-'
      OR COALESCE(NULLIF(UPPER(BTRIM(r.nama_pt)), ''), '-') <>
         COALESCE(NULLIF(UPPER(BTRIM(t.nama_kontraktor)), ''), '-')
  )
ORDER BY r.created_at DESC, r.id DESC;

-- 2) RAB whose submitted PT/CV differs from user_cabang mapping for same email + branch.
SELECT
    r.id AS rab_id,
    t.nomor_ulok,
    t.cabang,
    t.lingkup_pekerjaan,
    r.nama_pt AS rab_nama_pt,
    uc.nama_pt AS mapped_nama_pt,
    uc.jabatan AS mapped_jabatan,
    r.email_pembuat,
    r.created_at
FROM rab r
JOIN toko t ON t.id = r.id_toko
JOIN user_cabang uc
  ON LOWER(uc.email_sat) = LOWER(r.email_pembuat)
 AND LOWER(uc.cabang) = LOWER(t.cabang)
WHERE NULLIF(BTRIM(uc.nama_pt), '') IS NOT NULL
  AND BTRIM(uc.nama_pt) <> '-'
  AND COALESCE(NULLIF(UPPER(BTRIM(r.nama_pt)), ''), '-') <>
      COALESCE(NULLIF(UPPER(BTRIM(uc.nama_pt)), ''), '-')
ORDER BY r.created_at DESC, r.id DESC;

-- 3) Same ULOK with multiple branch or contractor identities.
SELECT
    t.nomor_ulok,
    COUNT(*) AS toko_rows,
    COUNT(DISTINCT UPPER(BTRIM(COALESCE(t.cabang, '')))) AS branch_count,
    COUNT(DISTINCT UPPER(BTRIM(COALESCE(t.nama_kontraktor, '')))) AS contractor_count,
    STRING_AGG(DISTINCT COALESCE(t.cabang, '-'), ', ' ORDER BY COALESCE(t.cabang, '-')) AS cabang_values,
    STRING_AGG(DISTINCT COALESCE(t.lingkup_pekerjaan, '-'), ', ' ORDER BY COALESCE(t.lingkup_pekerjaan, '-')) AS lingkup_values,
    STRING_AGG(DISTINCT COALESCE(t.nama_kontraktor, '-'), ', ' ORDER BY COALESCE(t.nama_kontraktor, '-')) AS contractor_values
FROM toko t
GROUP BY t.nomor_ulok
HAVING COUNT(DISTINCT UPPER(BTRIM(COALESCE(t.cabang, '')))) > 1
    OR COUNT(DISTINCT UPPER(BTRIM(COALESCE(t.nama_kontraktor, '')))) > 1
ORDER BY t.nomor_ulok;

-- 4) RAB/SPH data with missing kop-surat fields.
SELECT
    r.id AS rab_id,
    t.nomor_ulok,
    t.cabang,
    t.lingkup_pekerjaan,
    r.nama_pt,
    r.no_polis,
    r.berlaku_polis,
    r.logo,
    r.link_pdf_sph,
    r.created_at
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE NULLIF(BTRIM(r.nama_pt), '') IS NULL
   OR BTRIM(r.nama_pt) = '-'
   OR NULLIF(BTRIM(r.no_polis), '') IS NULL
   OR NULLIF(BTRIM(r.berlaku_polis), '') IS NULL
   OR NULLIF(BTRIM(r.logo), '') IS NULL
ORDER BY r.created_at DESC, r.id DESC;

-- 5) Lingkup pekerjaan outside canonical SIPIL/ME.
SELECT
    r.id AS rab_id,
    t.nomor_ulok,
    t.cabang,
    t.lingkup_pekerjaan,
    r.nama_pt,
    r.created_at
FROM rab r
JOIN toko t ON t.id = r.id_toko
WHERE UPPER(BTRIM(COALESCE(t.lingkup_pekerjaan, ''))) NOT IN ('SIPIL', 'ME')
ORDER BY r.created_at DESC, r.id DESC;
