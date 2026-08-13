import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // Find Toko entries
    const tokoRes = await client.query(`
        SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko 
        FROM toko 
        WHERE nomor_ulok = 'CZ01-2607-CD28-R'
    `);
    console.log("Toko entries:", tokoRes.rows);
    
    for (const toko of tokoRes.rows) {
        // Find RAB
        const rabRes = await client.query(`
            SELECT id, durasi_pekerjaan FROM rab WHERE id_toko = $1
        `, [toko.id]);
        console.log(`RAB for ${toko.lingkup_pekerjaan}:`, rabRes.rows);
        
        // Find Gantt Chart
        const gcRes = await client.query(`
            SELECT id FROM gantt_chart WHERE id_toko = $1
        `, [toko.id]);
        
        if (gcRes.rows.length > 0) {
            const id_gc = gcRes.rows[0].id;
            console.log(`Gantt ID for ${toko.lingkup_pekerjaan}:`, id_gc);
            
            const dayRes = await client.query(`
                SELECT k.kategori_pekerjaan, d.h_awal, d.h_akhir
                FROM day_gantt_chart d
                JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
                WHERE d.id_gantt = $1
                ORDER BY CAST(d.h_awal AS INTEGER)
            `, [id_gc]);
            
            console.log(`Gantt Items for ${toko.lingkup_pekerjaan}:`);
            dayRes.rows.forEach(r => console.log(`  ${r.kategori_pekerjaan}: Hari ${r.h_awal} - ${r.h_akhir}`));
        } else {
            console.log(`No Gantt Chart found for ${toko.lingkup_pekerjaan}`);
        }
    }
    
    await client.end();
}

main().catch(console.error);
