import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    const tokoRes = await client.query(`
        SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko 
        FROM toko 
        WHERE nomor_ulok = '1SZ1-2606-0003'
    `);
    
    console.log("Toko entries for 1SZ1-2606-0003:", tokoRes.rows);
    
    const id_tokos = tokoRes.rows.map(r => r.id);
    
    if (id_tokos.length > 0) {
        const updateRes = await client.query(`
            UPDATE rab 
            SET durasi_pekerjaan = '20' 
            WHERE id_toko = ANY($1)
            RETURNING id, id_toko, durasi_pekerjaan
        `, [id_tokos]);
        
        console.log("Updated RAB entries:", updateRes.rows);
    }
    
    await client.end();
}

main().catch(console.error);
