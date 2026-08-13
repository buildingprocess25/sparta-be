import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // Update INSTALASI
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '15', h_akhir = '18' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23717
    `);
    
    // Update FIXTURE
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '16', h_akhir = '18' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23718
    `);
    
    // Update PEKERJAAN TAMBAHAN
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '15', h_akhir = '18' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23719
    `);
    
    console.log("Successfully updated ME Gantt Chart schedules.");
    
    await client.end();
}

main().catch(console.error);
