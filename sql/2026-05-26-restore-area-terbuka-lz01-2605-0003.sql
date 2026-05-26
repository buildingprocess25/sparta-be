-- Mengembalikan item LZ01-2605-0003 ke kategori dan harga sesuai input user.
-- Kasus: beberapa item PEKERJAAN AREA TERBUKA terlanjur tersinkron ke kategori master.
-- Catatan: volume di beberapa DB bertipe varchar, jadi dibandingkan lewat volume_num.

WITH target_rab AS (
    SELECT r.id
    FROM rab r
    JOIN toko t ON t.id = r.id_toko
    WHERE t.nomor_ulok = 'LZ01-2605-0003'
      AND UPPER(COALESCE(t.lingkup_pekerjaan, '')) LIKE '%SIPIL%'
),
source_items AS (
    SELECT
        ri.*,
        CASE
            WHEN REPLACE(ri.volume::text, ',', '.') ~ '^\d+(\.\d+)?$'
                THEN REPLACE(ri.volume::text, ',', '.')::numeric
            ELSE NULL
        END AS volume_num,
        CASE
            WHEN REPLACE(ri.harga_material::text, ',', '.') ~ '^\d+(\.\d+)?$'
                THEN REPLACE(ri.harga_material::text, ',', '.')::numeric
            ELSE 0
        END AS harga_material_num,
        CASE
            WHEN REPLACE(ri.harga_upah::text, ',', '.') ~ '^\d+(\.\d+)?$'
                THEN REPLACE(ri.harga_upah::text, ',', '.')::numeric
            ELSE 0
        END AS harga_upah_num
    FROM rab_item ri
    JOIN target_rab tr ON tr.id = ri.id_rab
),
fixed_items AS (
    SELECT
        ri.id,
        ri.volume_num,
        CASE
            WHEN LOWER(ri.jenis_pekerjaan) = LOWER('Galian tanah') AND ri.volume_num = 6.1 THEN 'M3'
            WHEN ri.jenis_pekerjaan ILIKE 'Sloof beton 15x20 cm%' AND ri.volume_num = 0.38 THEN 'M3'
            WHEN ri.jenis_pekerjaan ILIKE 'Kolom praktis 10x15 cm%' AND ri.volume_num = 0.05 THEN 'M3'
            WHEN ri.jenis_pekerjaan ILIKE 'Pasangan dinding bata%' AND ri.volume_num = 7.68 THEN 'M2'
            WHEN ri.jenis_pekerjaan ILIKE 'Plester + aci untuk pasangan dinding bata%' AND ri.volume_num = 15.36 THEN 'M2'
            WHEN ri.jenis_pekerjaan ILIKE 'Cat dinding luar merk Avitek Super White eksterior%' AND ri.volume_num = 15.36 THEN 'M2'
            WHEN ri.jenis_pekerjaan ILIKE 'Cat merk Nippon roadline warna kuning%' AND ri.volume_num = 1.5 THEN 'M2'
            WHEN ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 3 inch%' AND ri.volume_num = 50.82 THEN 'Kg'
            WHEN ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 4 inch%' AND ri.volume_num = 121 THEN 'Kg'
            ELSE ri.satuan::text
        END AS satuan_baru,
        CASE
            WHEN LOWER(ri.jenis_pekerjaan) = LOWER('Galian tanah') AND ri.volume_num = 6.1 THEN 0
            WHEN ri.jenis_pekerjaan ILIKE 'Sloof beton 15x20 cm%' AND ri.volume_num = 0.38 THEN 4062000
            WHEN ri.jenis_pekerjaan ILIKE 'Kolom praktis 10x15 cm%' AND ri.volume_num = 0.05 THEN 4062000
            WHEN ri.jenis_pekerjaan ILIKE 'Pasangan dinding bata%' AND ri.volume_num = 7.68 THEN 95000
            WHEN ri.jenis_pekerjaan ILIKE 'Plester + aci untuk pasangan dinding bata%' AND ri.volume_num = 15.36 THEN 33100
            WHEN ri.jenis_pekerjaan ILIKE 'Cat dinding luar merk Avitek Super White eksterior%' AND ri.volume_num = 15.36 THEN 18000
            WHEN ri.jenis_pekerjaan ILIKE 'Cat merk Nippon roadline warna kuning%' AND ri.volume_num = 1.5 THEN 61700
            WHEN ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 3 inch%' AND ri.volume_num = 50.82 THEN 27300
            WHEN ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 4 inch%' AND ri.volume_num = 121 THEN 27300
            ELSE ri.harga_material_num
        END::numeric AS harga_material_baru,
        CASE
            WHEN LOWER(ri.jenis_pekerjaan) = LOWER('Galian tanah') AND ri.volume_num = 6.1 THEN 80000
            WHEN ri.jenis_pekerjaan ILIKE 'Sloof beton 15x20 cm%' AND ri.volume_num = 0.38 THEN 970000
            WHEN ri.jenis_pekerjaan ILIKE 'Kolom praktis 10x15 cm%' AND ri.volume_num = 0.05 THEN 970000
            WHEN ri.jenis_pekerjaan ILIKE 'Pasangan dinding bata%' AND ri.volume_num = 7.68 THEN 40000
            WHEN ri.jenis_pekerjaan ILIKE 'Plester + aci untuk pasangan dinding bata%' AND ri.volume_num = 15.36 THEN 62000
            WHEN ri.jenis_pekerjaan ILIKE 'Cat dinding luar merk Avitek Super White eksterior%' AND ri.volume_num = 15.36 THEN 8600
            WHEN ri.jenis_pekerjaan ILIKE 'Cat merk Nippon roadline warna kuning%' AND ri.volume_num = 1.5 THEN 12500
            WHEN ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 3 inch%' AND ri.volume_num = 50.82 THEN 6500
            WHEN ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 4 inch%' AND ri.volume_num = 121 THEN 6500
            ELSE ri.harga_upah_num
        END::numeric AS harga_upah_baru
    FROM source_items ri
    WHERE (
        (LOWER(ri.jenis_pekerjaan) = LOWER('Galian tanah') AND ri.volume_num = 6.1)
        OR (ri.jenis_pekerjaan ILIKE 'Sloof beton 15x20 cm%' AND ri.volume_num = 0.38)
        OR (ri.jenis_pekerjaan ILIKE 'Kolom praktis 10x15 cm%' AND ri.volume_num = 0.05)
        OR (ri.jenis_pekerjaan ILIKE 'Pasangan dinding bata%' AND ri.volume_num = 7.68)
        OR (ri.jenis_pekerjaan ILIKE 'Plester + aci untuk pasangan dinding bata%' AND ri.volume_num = 15.36)
        OR (ri.jenis_pekerjaan ILIKE 'Cat dinding luar merk Avitek Super White eksterior%' AND ri.volume_num = 15.36)
        OR (ri.jenis_pekerjaan ILIKE 'Cat merk Nippon roadline warna kuning%' AND ri.volume_num = 1.5)
        OR (ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 3 inch%' AND ri.volume_num = 50.82)
        OR (ri.jenis_pekerjaan ILIKE 'Pasang tiang pipa besi 4 inch%' AND ri.volume_num = 121)
    )
),
updated_items AS (
    UPDATE rab_item ri
    SET kategori_pekerjaan = 'PEKERJAAN AREA TERBUKA',
        satuan = fi.satuan_baru,
        harga_material = fi.harga_material_baru,
        harga_upah = fi.harga_upah_baru,
        total_material = ROUND(fi.volume_num * fi.harga_material_baru),
        total_upah = ROUND(fi.volume_num * fi.harga_upah_baru),
        total_harga = ROUND(fi.volume_num * fi.harga_material_baru) + ROUND(fi.volume_num * fi.harga_upah_baru)
    FROM fixed_items fi
    WHERE ri.id = fi.id
    RETURNING ri.id_rab
),
totals AS (
    SELECT
        ri.id_rab,
        SUM(ri.total_harga)::numeric AS grand_total,
        SUM(CASE WHEN UPPER(TRIM(ri.kategori_pekerjaan)) <> 'PEKERJAAN SBO' THEN ri.total_harga ELSE 0 END)::numeric AS grand_total_non_sbo
    FROM rab_item ri
    WHERE ri.id_rab IN (SELECT DISTINCT id_rab FROM updated_items)
    GROUP BY ri.id_rab
)
UPDATE rab r
SET grand_total = totals.grand_total,
    grand_total_non_sbo = totals.grand_total_non_sbo,
    grand_total_final = FLOOR(totals.grand_total / 10000) * 10000 * 1.11
FROM totals
WHERE r.id = totals.id_rab;

SELECT
    ri.id_rab,
    ri.kategori_pekerjaan,
    COUNT(*) AS jumlah_item,
    SUM(ri.total_material) AS total_material,
    SUM(ri.total_upah) AS total_upah,
    SUM(ri.total_harga) AS total_harga
FROM rab_item ri
JOIN rab r ON r.id = ri.id_rab
JOIN toko t ON t.id = r.id_toko
WHERE t.nomor_ulok = 'LZ01-2605-0003'
  AND UPPER(COALESCE(t.lingkup_pekerjaan, '')) LIKE '%SIPIL%'
GROUP BY ri.id_rab, ri.kategori_pekerjaan
ORDER BY ri.id_rab, ri.kategori_pekerjaan;
