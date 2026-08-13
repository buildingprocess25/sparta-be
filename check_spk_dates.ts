import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../sparta-be.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    await client.connect();
    
    // Check Projek Planning for Sipil (2549) and ME (2663)
    const ppRes = await client.query(`
        SELECT p.id, p.id_toko, p.spk_start, p.target_st, p.target_st_me, p.tgl_spk_me, p.target_st_sipil, p.tgl_spk_sipil
        FROM projek_planning p
        WHERE p.id_toko IN (2549, 2663) OR p.nomor_ulo = '1SZ1-2606-0003'
    `);
    
    console.log("Projek Planning:", ppRes.rows);
    
    // Check Gantt Chart again
    const gcRes = await client.query(`
        SELECT id, id_toko, lingkup_pekerjaan FROM gantt_chart WHERE id_toko IN (2549, 2663)
    `);
    console.log("Gantt Charts:", gcRes.rows);
    
    for (const gc of gcRes.rows) {
        const dayRes = await client.query(`
            SELECT k.kategori_pekerjaan, d.h_awal, d.h_akhir
            FROM day_gantt_chart d
            JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
            WHERE d.id_gantt = $1
        `, [gc.id]);
        console.log(`Gantt Items for ${gc.lingkup_pekerjaan} (id_toko: ${gc.id_toko}):`);
        dayRes.rows.forEach(r => console.log(`  ${r.kategori_pekerjaan}: ${r.h_awal} - ${r.h_akhir}`));
    }
    
    await client.end();
}

main().catch(console.error);
