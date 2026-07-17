-- Koreksi kategori lokasi RAB LUWU renovasi yang sebelumnya tercatat NON RUKO.
-- Scope sengaja dibatasi ke 10 baris RAB approved yang terkonfirmasi dari laporan.

BEGIN;

WITH target_ulok(nomor_ulok, lingkup_pekerjaan) AS (
    VALUES
        ('2VZ1-2605-2V09-R', 'ME'),
        ('2VZ1-2605-2V09-R', 'SIPIL'),
        ('2VZ1-2605-R566-R', 'ME'),
        ('2VZ1-2605-R566-R', 'SIPIL'),
        ('2VZ1-2605-R772-R', 'ME'),
        ('2VZ1-2605-R772-R', 'SIPIL'),
        ('2VZ1-2605-R799-R', 'ME'),
        ('2VZ1-2605-R799-R', 'SIPIL'),
        ('2VZ1-2605-R822-R', 'ME'),
        ('2VZ1-2605-R825-R', 'ME')
)
UPDATE rab r
SET kategori_lokasi = 'RUKO'
FROM toko t
JOIN target_ulok target
  ON target.nomor_ulok = t.nomor_ulok
 AND target.lingkup_pekerjaan = UPPER(TRIM(t.lingkup_pekerjaan))
WHERE r.id_toko = t.id
  AND r.status = 'Disetujui'
  AND UPPER(TRIM(t.cabang)) = 'LUWU'
  AND UPPER(COALESCE(t.proyek, '')) LIKE '%RENOVASI%'
  AND UPPER(COALESCE(r.kategori_lokasi, '')) LIKE '%NON%RUKO%';

WITH target_ulok(nomor_ulok, lingkup_pekerjaan) AS (
    VALUES
        ('2VZ1-2605-2V09-R', 'ME'),
        ('2VZ1-2605-2V09-R', 'SIPIL'),
        ('2VZ1-2605-R566-R', 'ME'),
        ('2VZ1-2605-R566-R', 'SIPIL'),
        ('2VZ1-2605-R772-R', 'ME'),
        ('2VZ1-2605-R772-R', 'SIPIL'),
        ('2VZ1-2605-R799-R', 'ME'),
        ('2VZ1-2605-R799-R', 'SIPIL'),
        ('2VZ1-2605-R822-R', 'ME'),
        ('2VZ1-2605-R825-R', 'ME')
)
UPDATE pic_pengawasan pic
SET kategori_lokasi = 'RUKO'
FROM toko t
JOIN target_ulok target
  ON target.nomor_ulok = t.nomor_ulok
 AND target.lingkup_pekerjaan = UPPER(TRIM(t.lingkup_pekerjaan))
WHERE pic.id_toko = t.id
  AND UPPER(TRIM(t.cabang)) = 'LUWU'
  AND UPPER(COALESCE(t.proyek, '')) LIKE '%RENOVASI%'
  AND UPPER(COALESCE(pic.kategori_lokasi, '')) LIKE '%NON%RUKO%';

COMMIT;
