import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../sparta-be.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const nomor_ulok = 'Z001-3008-1234';
    console.log(`--- TOKO FOR ULOK ${nomor_ulok} ---`);
    const toko = await pool.query('SELECT id, nama_toko, lingkup_pekerjaan FROM toko WHERE nomor_ulok = $1 ORDER BY id DESC', [nomor_ulok]);
    console.log(toko.rows);
    
    if (toko.rows.length > 0) {
        for (const t of toko.rows) {
            console.log(`\n--- GANTT FOR TOKO ID ${t.id} (${t.lingkup_pekerjaan}) ---`);
            const gantts = await pool.query('SELECT id, status FROM gantt_chart WHERE id_toko = $1', [t.id]);
            console.log(gantts.rows);
            
            for (const g of gantts.rows) {
                console.log(`--- PENGAWASAN FOR GANTT ID ${g.id} ---`);
                try {
                    const p_gantt = await pool.query('SELECT id, tanggal_pengawasan, workflow_version FROM pengawasan_gantt WHERE id_gantt = $1', [g.id]);
                    console.log(p_gantt.rows);
                } catch (e: any) {
                    console.log("Error querying pengawasan_gantt:", e.message);
                }
            }
        }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

run();
