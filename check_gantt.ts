import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // Check Gantt Chart for ME (id_toko = 2663)
    const ganttRes = await client.query(`
        SELECT * FROM gantt_chart WHERE id_toko = 2663
    `);
    
    console.log("Gantt Chart (ME):", ganttRes.rows);
    
    if (ganttRes.rows.length > 0) {
        const id_gantt = ganttRes.rows[0].id;
        
        const katRes = await client.query(`
            SELECT * FROM kategori_pekerjaan_gantt WHERE id_gantt = $1
        `, [id_gantt]);
        
        console.log("Kategori (ME):", katRes.rows);
        
        const dayRes = await client.query(`
            SELECT * FROM day_gantt_chart WHERE id_gantt = $1 ORDER BY h_awal
        `, [id_gantt]);
        
        console.log("Days (ME):", dayRes.rows);
    }
    
    await client.end();
}

main().catch(console.error);
