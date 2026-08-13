import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // Find ULO in toko or projek_planning
    try {
        const tokoRes = await client.query(`
            SELECT * FROM toko WHERE nomor_ulok ILIKE '%1SZ1-2606-0003%' OR nama_toko ILIKE '%RAYA MASBAGIK PANCOR%'
        `);
        console.log("Toko found:", tokoRes.rows);
        
        if (tokoRes.rows.length > 0) {
            const id_toko = tokoRes.rows[0].id;
            
            const rabRes = await client.query(`
                SELECT id, id_toko, durasi_pekerjaan FROM rab WHERE id_toko = $1
            `, [id_toko]);
            console.log("RAB found:", rabRes.rows);
            
            // Look into spk as well
            const spkRes = await client.query(`
                SELECT id, id_toko, spk_sipil, spk_me, addendum_sipil, addendum_me FROM projek_planning WHERE id_toko = $1
            `, [id_toko]);
            console.log("Projek planning found:", spkRes.rows);
        }
    } catch(e) {
        console.error(e);
    }
    
    await client.end();
}

main().catch(console.error);
