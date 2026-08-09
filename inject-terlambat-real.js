const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const targetDates = [900, 901, 902, 903, 4140, 4617];
const imageDocUrl = 'https://via.placeholder.com/800x600.png?text=Intervensi';

async function inject() {
    try {
        // 1. Get the REAL 13 INSTALASI items from RAB
        const rabRes = await pool.query(`
            SELECT DISTINCT jenis_pekerjaan 
            FROM rab_item ri 
            JOIN rab r ON r.id = ri.id_rab 
            WHERE r.id_toko=1886 AND ri.kategori_pekerjaan='INSTALASI'
        `);
        const realItems = rabRes.rows.map(row => row.jenis_pekerjaan.trim());
        console.log(`Found ${realItems.length} real INSTALASI items for this store.`);

        // 2. Delete ALL existing INSTALASI from July dates
        const placeholders = targetDates.map((_, i) => `$${i + 1}`).join(',');
        const delRes = await pool.query(`
            DELETE FROM pengawasan 
            WHERE id_pengawasan_gantt IN (${placeholders}) 
              AND kategori_pekerjaan = 'INSTALASI'
        `, targetDates);
        console.log(`Deleted ${delRes.rowCount} incorrect INSTALASI records from July dates.`);

        // 3. Inject the REAL items for July dates
        for (const idPg of targetDates) {
            console.log(`Injecting real items for Date ID ${idPg}...`);
            for (const item of realItems) {
                await pool.query(`
                    INSERT INTO pengawasan (
                        id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, status, dokumentasi, catatan
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7
                    )
                `, [
                    550, idPg, 'INSTALASI', item, 'terlambat',
                    imageDocUrl,
                    'Intervensi Terlambat'
                ]);
            }
        }
        console.log('All real injections complete!');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
inject();
