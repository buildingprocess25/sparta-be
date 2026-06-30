-- Preview repair rab_item untuk RAB approved Cepoko Baru SMG.
-- Sumber: PDF snapshot DB lama non_sbo.pdf untuk rab_id=780, grand_total_final=18.237.300.
-- Mode aman: transaksi diakhiri ROLLBACK. Ganti ROLLBACK menjadi COMMIT hanya setelah preview disetujui.

BEGIN;

WITH target_rab AS (
    SELECT r.id
    FROM rab r
    JOIN toko t ON t.id = r.id_toko
    WHERE r.id = 780
      AND t.nomor_ulok = 'HZ01-2604-HD65-R'
      AND t.nama_toko = 'CEPOKO BARU SMG'
      AND r.status = 'Disetujui'
      AND r.grand_total = '16438525'
      AND r.grand_total_final = '18237300'
      AND NOT EXISTS (
          SELECT 1
          FROM rab_item ri
          WHERE ri.id_rab = r.id
      )
),
source_items (
    kategori_pekerjaan,
    jenis_pekerjaan,
    satuan,
    volume,
    harga_material,
    harga_upah,
    total_material,
    total_upah,
    total_harga
) AS (
    VALUES
    ('PEKERJAAN PERSIAPAN', 'Pembersihan lokasi', 'Ls', '1', '0', '1500000', '0', '1500000', '1500000'),
    ('PEKERJAAN BOBOKAN / BONGKARAN', 'Bongkaran & buang puing bekas pekerjaan renovasi', 'Ls', '1', '0', '3500000', '0', '3500000', '3500000'),
    ('PEKERJAAN TANAH', 'Galian tanah', 'M3', '0.31', '0', '65000', '0', '20150', '20150'),
    ('PEKERJAAN TANAH', 'Urug tanah kembali', 'M3', '0.1', '0', '36500', '0', '3650', '3650'),
    ('PEKERJAAN PONDASI & BETON', 'Pondasi rolaq bata, 1 pc : 6 ps', 'M1', '3.85', '24000', '27500', '92400', '105875', '198275'),
    ('PEKERJAAN PASANGAN', 'Pasangan dinding bata, 1 pc : 6 ps', 'M2', '0.66', '110000', '30000', '72600', '19800', '92400'),
    ('PEKERJAAN PASANGAN', 'Plester + aci untuk pasangan dinding bata 1 pc : 6 ps', 'M2', '25.04', '30000', '35000', '751200', '876400', '1627600'),
    ('PEKERJAAN KERAMIK', 'Pasang keramik lantai KM / WC 60x60 merk Platinum Sicily Dark Grey**Nat menggunakan semen (portland cement)', 'M2', '3.66', '150000', '43000', '549000', '157380', '706380'),
    ('PEKERJAAN KERAMIK', 'Pasang keramik dinding KM / WC 30x60 merk Platinum Bonza white **Nat menggunakan semen (portland cement)', 'M2', '21.23', '144000', '45000', '3057120', '955350', '4012470'),
    ('PEKERJAAN PLUMBING', 'Instalasi pipa PVC 4" tipe D Wavin horizontal', 'M1', '2', '75000', '8500', '150000', '17000', '167000'),
    ('PEKERJAAN PLUMBING', 'Instalasi air bersih pipa PVC 3/4 inch tipe AW Wavin / Rucika (include aksesoris)', 'M1', '4', '18000', '6500', '72000', '26000', '98000'),
    ('PEKERJAAN SANITARY & ACECORIES', 'Pasang closet jongkok merk Toto CE7 warna putih', 'Bh', '1', '417500', '110000', '417500', '110000', '527500'),
    ('PEKERJAAN SANITARY & ACECORIES', 'Kran air merk Onda tipe CLS', 'Bh', '1', '92000', '8000', '92000', '8000', '100000'),
    ('PEKERJAAN SANITARY & ACECORIES', 'Floor drain kotak stainless berlubang ukuran 5 mm, dimensi 10x10 cm', 'Bh', '1', '56000', '17000', '56000', '17000', '73000'),
    ('PEKERJAAN JANITOR', 'a. Pasangan batu bata', 'M2', '0.48', '110000', '30000', '52800', '14400', '67200'),
    ('PEKERJAAN JANITOR', 'b. Pasangan Keramik 40x40 merk Asia Tile tinggi: 1,6 m', 'M2', '5.31', '109000', '43000', '578790', '228330', '807120'),
    ('PEKERJAAN JANITOR', 'c. Kran air merk Onda tipe CLS.', 'Bh', '1', '92000', '8000', '92000', '8000', '100000'),
    ('PEKERJAAN JANITOR', 'd. Floor drain kotak stainless berlubang ukuran 5 mm dimensi 10x10 cm', 'Bh', '2', '56000', '17000', '112000', '34000', '146000'),
    ('PEKERJAAN FINISHING', 'Cat dinding dalam merk Avitek interior white', 'M2', '8.16', '13500', '7500', '110160', '61200', '171360'),
    ('PEKERJAAN FINISHING', 'Cat plafond merk Avitek interior white', 'M2', '9', '13500', '7500', '121500', '67500', '189000'),
    ('PEKERJAAN FINISHING', 'Cat Propan Multipox MX 99 Light Grey', 'M2', '10.12', '48000', '7500', '485760', '75900', '561660'),
    ('PEKERJAAN TAMBAHAN', 'Pasang keramik lantai 40x40 merk Asia Tile tipe Oscar Grey untuk teras**Nat menggunakan semen (portland cement)', 'M2', '0.72', '115000', '43000', '82800', '30960', '113760'),
    ('PEKERJAAN TAMBAHAN', 'Gantungan baju double hook Merk Onda ARH 105 / gantungan handuk / gantungan baju', 'Unit', '1', '189000', '21000', '189000', '21000', '210000'),
    ('PEKERJAAN TAMBAHAN', 'Tempat alat kebersihan merk AZKO Stora Organizer Sapu & Alat Pel 6 Hook - Hitam Broom And Mop Holder Tempat Sapu Dan Pel Organizer Alat Kebersihan', 'Unit', '1', '135000', '21000', '135000', '21000', '156000'),
    ('PEKERJAAN TAMBAHAN', 'Tempat sampah tutup goyang ukuran 5 liter', 'Bh', '1', '30000', '0', '30000', '0', '30000'),
    ('PEKERJAAN TAMBAHAN', 'Gayung gagang bulat warna abu-abu', 'Bh', '1', '15000', '0', '15000', '0', '15000'),
    ('PEKERJAAN TAMBAHAN', 'Ember 30 liter warna abu-abu', 'Bh', '1', '60000', '0', '60000', '0', '60000'),
    ('PEKERJAAN TAMBAHAN', 'Pintu Kamar Mandi UPVC full panel menggunakan handle + kunci knob ukuran 70x200 cm Warna Putih**include accesories', 'Unit', '1', '1050000', '135000', '1050000', '135000', '1185000')
),
inserted AS (
    INSERT INTO rab_item (
        id_rab,
        kategori_pekerjaan,
        jenis_pekerjaan,
        satuan,
        volume,
        harga_material,
        harga_upah,
        total_material,
        total_upah,
        total_harga,
        catatan
    )
    SELECT
        tr.id,
        si.kategori_pekerjaan,
        si.jenis_pekerjaan,
        si.satuan,
        si.volume,
        si.harga_material,
        si.harga_upah,
        si.total_material::int,
        si.total_upah::int,
        si.total_harga::int,
        'Backfill dari PDF RAB approved Cepoko Rp18.237.300 snapshot 2026-05-08'
    FROM target_rab tr
    CROSS JOIN source_items si
    RETURNING *
)
SELECT
    COUNT(*) AS inserted_count,
    COALESCE(SUM(total_material), 0) AS total_material,
    COALESCE(SUM(total_upah), 0) AS total_upah,
    COALESCE(SUM(total_harga), 0) AS total_harga
FROM inserted;

SELECT
    kategori_pekerjaan,
    COUNT(*) AS item_count,
    SUM(total_material) AS total_material,
    SUM(total_upah) AS total_upah,
    SUM(total_harga) AS total_harga
FROM rab_item
WHERE id_rab = 780
GROUP BY kategori_pekerjaan
ORDER BY MIN(id);

ROLLBACK;
