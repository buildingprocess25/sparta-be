import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // We want UI to show 15-18. If DB=15 shows as 29, then offset is 14.
    // So we set DB = 1 to show as 15.
    
    // Update INSTALASI
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '1', h_akhir = '4' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23717
    `);
    
    // Update FIXTURE
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '2', h_akhir = '4' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23718
    `);
    
    // Update PEKERJAAN TAMBAHAN
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '1', h_akhir = '4' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23719
    `);
    
    console.log("Successfully shifted ME Gantt Chart schedules by -14 days.");
    
    await client.end();
}

main().catch(console.error);
