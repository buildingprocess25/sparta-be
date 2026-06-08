-- Audit IL items that were saved before the price parser kept section categories correctly.
SELECT
    ili.id AS id_instruksi_lapangan_item,
    ili.id_instruksi_lapangan,
    il.id_toko,
    t.nomor_ulok,
    t.nama_toko,
    t.lingkup_pekerjaan,
    ili.kategori_pekerjaan,
    ili.jenis_pekerjaan
FROM instruksi_lapangan_item ili
JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
JOIN toko t ON t.id = il.id_toko
WHERE UPPER(TRIM(ili.kategori_pekerjaan)) = 'UNCATEGORIZED'
ORDER BY il.created_at DESC, ili.id ASC;

-- DC Cianjur IL #44: item ini berasal dari kategori FIXTURE.
UPDATE instruksi_lapangan_item
SET kategori_pekerjaan = 'FIXTURE'
WHERE id = 31
  AND id_instruksi_lapangan = 44
  AND UPPER(TRIM(kategori_pekerjaan)) = 'UNCATEGORIZED'
  AND jenis_pekerjaan ILIKE 'Openback Alumunium 3 inchi + tutup coating putih%';
