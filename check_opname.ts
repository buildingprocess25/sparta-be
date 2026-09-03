import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // Check opname_item for Toko 2599
    const res = await client.query(`
        SELECT id, id_rab_item, status, foto, catatan, tanggal_slot_opname, id_pengawasan_gantt_target
        FROM opname_item 
        WHERE id_toko = 2599 AND (tanggal_slot_opname IN ('2026-08-24', '2026-08-26') OR id_pengawasan_gantt_target IN (4364, 4723))
    `);
    
    console.log("Opname Items (Toko 2599, Gantt SIPIL Dates):");
    console.table(res.rows);

    await client.end();
}

main().catch(console.error);
