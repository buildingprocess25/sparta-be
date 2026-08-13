import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // We want ME items to appear at UI Day 10-14.
    // The UI adds a 5-day offset to ME items for this project (DB h_akhir 14 was shown as UI Day 19).
    // So we subtract 5 from our desired UI Days to get the DB Days.
    
    // UI Target:
    // INSTALASI: 10-12 -> DB: 5-7
    // FIXTURE: 12-14 -> DB: 7-9
    // PEKERJAAN TAMBAHAN: 10-14 -> DB: 5-9
    
    // Find ME Gantt categories (id_gantt = 1715)
    const katRes = await client.query(`
        SELECT id, kategori_pekerjaan FROM kategori_pekerjaan_gantt WHERE id_gantt = 1715
    `);
    
    for (const k of katRes.rows) {
        let new_awal = '';
        let new_akhir = '';
        
        if (k.kategori_pekerjaan === 'INSTALASI') {
            new_awal = '5'; new_akhir = '7';
        } else if (k.kategori_pekerjaan === 'FIXTURE') {
            new_awal = '7'; new_akhir = '9';
        } else if (k.kategori_pekerjaan === 'PEKERJAAN TAMBAHAN') {
            new_awal = '5'; new_akhir = '9';
        }
        
        if (new_awal && new_akhir) {
            await client.query(`
                UPDATE day_gantt_chart 
                SET h_awal = $1, h_akhir = $2 
                WHERE id_gantt = 1715 AND id_kategori_pekerjaan_gantt = $3
            `, [new_awal, new_akhir, k.id]);
            
            console.log(`Updated ${k.kategori_pekerjaan} to ${new_awal}-${new_akhir} (UI: ${parseInt(new_awal)+5}-${parseInt(new_akhir)+5})`);
        }
    }
    
    console.log("Successfully shifted CZ01 ME Gantt Chart schedules with offset compensation.");
    
    await client.end();
}

main().catch(console.error);
