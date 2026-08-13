import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // id_toko 2549 is Sipil for 1SZ1-2606-0003
    const ganttRes = await client.query(`
        SELECT * FROM gantt_chart WHERE id_toko = 2549
    `);
    
    if (ganttRes.rows.length > 0) {
        const id_gantt = ganttRes.rows[0].id;
        console.log("Sipil Gantt ID:", id_gantt);
        
        const dayRes = await client.query(`
            SELECT k.kategori_pekerjaan, d.h_awal, d.h_akhir
            FROM day_gantt_chart d
            JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
            WHERE d.id_gantt = $1
            ORDER BY CAST(d.h_awal AS INTEGER)
        `, [id_gantt]);
        
        console.log("Sipil Gantt Items:");
        dayRes.rows.forEach(r => console.log(`${r.kategori_pekerjaan}: Hari ${r.h_awal} - ${r.h_akhir}`));
        
        // Let's also check if there are tasks extending beyond day 20
        const over20 = dayRes.rows.filter(r => parseInt(r.h_akhir) > 20);
        if (over20.length > 0) {
            console.log("WARNING: There are Sipil tasks exceeding 20 days!");
        }
    } else {
        console.log("No Gantt Chart found for Sipil (id_toko 2549)");
    }
    
    await client.end();
}

main().catch(console.error);
