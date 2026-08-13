import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // The user wants ME to be in the last week (15-18).
    // I previously mistakenly set it to 1-4 due to an incorrect offset assumption.
    // I will set it to exactly 15-18 as agreed in the brainstorming.
    
    // Update INSTALASI (23717)
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '15', h_akhir = '18' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23717
    `);
    
    // Update FIXTURE (23718)
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '16', h_akhir = '18' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23718
    `);
    
    // Update PEKERJAAN TAMBAHAN (23719)
    await client.query(`
        UPDATE day_gantt_chart 
        SET h_awal = '15', h_akhir = '18' 
        WHERE id_gantt = 1607 AND id_kategori_pekerjaan_gantt = 23719
    `);
    
    console.log("Successfully restored ME Gantt Chart schedules to 15-18.");
    
    await client.end();
}

main().catch(console.error);
