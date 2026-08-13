import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // 1. Update RAB for SIPIL to 14 days (id_toko = 2753)
    await client.query(`
        UPDATE rab SET durasi_pekerjaan = '14' WHERE id_toko = 2753
    `);
    
    console.log("Updated RAB for Sipil to 14 days.");
    
    // ME is already 14 days in RAB, no need to update.
    
    // 2. Fetch Day Gantt Items for Sipil (id_gantt = 1692)
    const dayRes = await client.query(`
        SELECT id, h_awal, h_akhir FROM day_gantt_chart WHERE id_gantt = 1692
    `);
    
    // 3. Compress proportionally (14 / 30)
    for (const row of dayRes.rows) {
        const old_awal = parseInt(row.h_awal);
        const old_akhir = parseInt(row.h_akhir);
        
        // Use Math.round for better distribution, max 14.
        let new_awal = Math.max(1, Math.round(old_awal * (14.0 / 30.0)));
        let new_akhir = Math.max(new_awal, Math.round(old_akhir * (14.0 / 30.0)));
        
        // Ensure nothing exceeds 14
        if (new_awal > 14) new_awal = 14;
        if (new_akhir > 14) new_akhir = 14;
        
        await client.query(`
            UPDATE day_gantt_chart 
            SET h_awal = $1, h_akhir = $2 
            WHERE id = $3
        `, [new_awal.toString(), new_akhir.toString(), row.id]);
        
        console.log(`Updated Day ID ${row.id}: ${old_awal}-${old_akhir} -> ${new_awal}-${new_akhir}`);
    }
    
    // ME Gantt items are already 7-9, 8-12, 11-14 which fit within 14 days, so we leave them intact.
    
    console.log("Successfully compressed Sipil Gantt Chart to 14 days.");
    
    await client.end();
}

main().catch(console.error);
