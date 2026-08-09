const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const instalasiItems = [
    'Instalasi induk lampu ( kabel NYM merk Eterna 2 x 1,5 mm2 )**include pipa condoit warna putih',
    'Instalasi paralel lampu ( kabel merk Eterna NYM 2 x 1,5 mm2 )**include pipa condoit warna putih',
    'Instalasi stop kontak khusus AC ( kabel NYM merk Eterna 3 x 2,5 mm2 )**include pipa condoit warna putih',
    'Instalasi induk stop kontak biasa ( kabel NYM merk Eterna 3 x 2,5 mm2 )**include pipa condoit warna putih',
    'Instalasi paralel stop kontak biasa ( kabel NYM merk Eterna 3 x 2,5 mm2 )**include pipa condoit warna putih',
    'Instalasi lampu single pole ( kabel NYM merk Eterna 2 x 2,5 mm2 + kabel NYAF 1 x 2,5 mm merk Eterna )**include pipa conduit warna putih / Tiang Lampu Sorot (Lampu sign)',
    'Instalasi pompa air ( kabel NYM merk Eterna 3 x 2,5 mm2 )**include pipa condoit warna putih',
    'Instalasi kabel induk (kabel NYM 4x6 mm Supreme/Kabel Metal)** dari kwh ke panel',
    'Instalasi grounding ke panel ( kabel bc 6 mm )',
    'Instalasi kabel speaker (kabel transparan 2x1,5 mm)** merk pajero',
    'Instalasi kabel data telpon (kabel ITC 2x0.6 mm)**Supreme',
    'Pembuatan box panel 30 x 40 lengkap dengan isi',
    'Instalasi stop kontak chiller / rack  ( kabel NYM merk Eterna 3 x 2,5 mm2 )**include pipa condoit warna putih'
];

const targetDates = [900, 901, 902, 903, 4140, 4617];
const imageDocUrl = 'https://via.placeholder.com/800x600.png?text=Intervensi';

async function inject() {
    try {
        // 1. Delete mistaken [IL] INSTALASI inserts
        const delRes = await pool.query(`DELETE FROM pengawasan WHERE id_gantt = 550 AND kategori_pekerjaan = '[IL] INSTALASI'`);
        console.log(`Deleted ${delRes.rowCount} mistaken [IL] INSTALASI records.`);
        
        // 2. Update June 26 (ID 899) from 'progress' to 'terlambat'
        const upRes = await pool.query(`
            UPDATE pengawasan 
            SET status = 'terlambat', 
                dokumentasi = $1,
                catatan = 'Intervensi Terlambat'
            WHERE id_pengawasan_gantt = 899 AND kategori_pekerjaan = 'INSTALASI'
        `, [imageDocUrl]);
        console.log(`Updated 26 Juni (899): ${upRes.rowCount} rows to Terlambat`);

        // 3. Inject for the rest of the dates
        for (const idPg of targetDates) {
            // Check if already injected
            const check = await pool.query(`SELECT id FROM pengawasan WHERE id_pengawasan_gantt = $1 AND kategori_pekerjaan = 'INSTALASI'`, [idPg]);
            if (check.rowCount > 0) {
                console.log(`Date ID ${idPg} already has INSTALASI items. Skipping insert.`);
                
                // Just update them to make sure
                await pool.query(`
                    UPDATE pengawasan 
                    SET status = 'terlambat', dokumentasi = $1, catatan = 'Intervensi Terlambat'
                    WHERE id_pengawasan_gantt = $1 AND kategori_pekerjaan = 'INSTALASI'
                `, [imageDocUrl, idPg]);
                continue;
            }

            console.log(`Injecting for Date ID ${idPg}...`);
            for (const item of instalasiItems) {
                await pool.query(`
                    INSERT INTO pengawasan (
                        id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, status, dokumentasi, catatan
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7
                    )
                `, [
                    550, idPg, 'INSTALASI', item.trim(), 'terlambat',
                    imageDocUrl,
                    'Intervensi Terlambat'
                ]);
            }
        }
        console.log('All injections complete!');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
inject();
