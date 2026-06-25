-- =========================================================
-- FIX: Isi kolom approval untuk Opname Final hasil migrasi
-- yang sebelumnya kosong (NULL)
-- Jalankan ini di database Aiven jika sudah pernah migrasi
-- =========================================================

-- Lihat dulu data mana yang perlu di-fix (status Disetujui tapi approval kosong)
SELECT 
    id, 
    email_pembuat,
    status_opname_final, 
    tipe_opname,
    pemberi_persetujuan_koordinator,
    waktu_persetujuan_koordinator,
    created_at
FROM opname_final
WHERE 
    status_opname_final = 'Disetujui'
    AND tipe_opname = 'OPNAME_FINAL'
    AND pemberi_persetujuan_koordinator IS NULL
ORDER BY id;

-- =========================================================
-- UPDATE: Isi approval dengan email_pembuat + created_at
-- sebagai fallback untuk data lama yang sudah telanjur migrasi
-- =========================================================
UPDATE opname_final
SET
    pemberi_persetujuan_koordinator = email_pembuat,
    waktu_persetujuan_koordinator   = created_at::timestamp,
    pemberi_persetujuan_manager     = email_pembuat,
    waktu_persetujuan_manager       = created_at::timestamp,
    pemberi_persetujuan_direktur    = email_pembuat,
    waktu_persetujuan_direktur      = created_at::timestamp
WHERE 
    status_opname_final = 'Disetujui'
    AND tipe_opname = 'OPNAME_FINAL'
    AND pemberi_persetujuan_koordinator IS NULL;

-- Cek hasilnya
SELECT 
    id, 
    email_pembuat,
    pemberi_persetujuan_koordinator,
    waktu_persetujuan_koordinator
FROM opname_final
WHERE status_opname_final = 'Disetujui' AND tipe_opname = 'OPNAME_FINAL'
ORDER BY id;
