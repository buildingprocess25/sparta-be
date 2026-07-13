-- Check LUWU records yang old_denda = 0 tapi seharusnya ada denda
-- Case: 2VZ1-2603-R353-R (AP PETTARANI WAJO)

WITH target_ulok AS (
    SELECT '2VZ1-2603-R353-R' AS ulok
)
SELECT 
    'PENGAJUAN_SPK' AS tabel,
    ps.id AS id_spk,
    ps.id_toko,
    ps.nomor_ulok,
    ps.waktu_selesai AS spk_end,
    ps.status AS spk_status,
    ps.created_at AS spk_created
FROM pengajuan_spk ps
WHERE ps.nomor_ulok = (SELECT ulok FROM target_ulok)

UNION ALL

SELECT 
    'BERKAS_SERAH_TERIMA' AS tabel,
    NULL AS id_spk,
    bst.id_toko,
    t.nomor_ulok,
    NULL AS spk_end,
    NULL AS spk_status,
    bst.created_at AS st_date
FROM berkas_serah_terima bst
JOIN toko t ON t.id = bst.id_toko
WHERE t.nomor_ulok = (SELECT ulok FROM target_ulok)

UNION ALL

SELECT 
    'OPNAME_FINAL' AS tabel,
    NULL AS id_spk,
    ofn.id_toko,
    t.nomor_ulok,
    ofn.tanggal_akhir_spk_denda,
    ofn.status_opname_final,
    ofn.created_at
FROM opname_final ofn
JOIN toko t ON t.id = ofn.id_toko
WHERE t.nomor_ulok = (SELECT ulok FROM target_ulok)

UNION ALL

SELECT 
    'OPNAME_FINAL_DENDA' AS tabel,
    NULL AS id_spk,
    ofn.id_toko,
    t.nomor_ulok,
    ofn.tanggal_serah_terima_denda,
    CONCAT('Denda: ', COALESCE(ofn.hari_denda::text, '0'), ' hari = Rp ', COALESCE(ofn.nilai_denda::text, '0')),
    NULL
FROM opname_final ofn
JOIN toko t ON t.id = ofn.id_toko
WHERE t.nomor_ulok = (SELECT ulok FROM target_ulok)

ORDER BY tabel, id_spk;
