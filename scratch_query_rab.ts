import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../sparta-be.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('--- RAB ---');
    const rab = await pool.query('SELECT * FROM rab WHERE id = $1', [2779]);
    console.log(rab.rows);
    
    if (rab.rows.length > 0) {
        const id_toko = rab.rows[0].id_toko;
        console.log(`id_toko from RAB is: ${id_toko}`);
        
        console.log('--- TOKO ---');
        const toko = await pool.query('SELECT * FROM toko WHERE id = $1', [id_toko]);
        console.log(toko.rows);
        
        const nomor_ulok = toko.rows.length > 0 ? toko.rows[0].nomor_ulok : null;
        console.log(`nomor_ulok is: ${nomor_ulok}`);
        
        if (nomor_ulok) {
            console.log('--- GANTT BY NOMOR ULOK ---');
            const gantts = await pool.query('SELECT * FROM gantt_chart WHERE nomor_ulok = $1', [nomor_ulok]);
            console.log(gantts.rows);
            
            for (const g of gantts.rows) {
                console.log(`--- DAY GANTT CHART BY ID_GANTT ${g.id} ---`);
                const day_gantts = await pool.query('SELECT * FROM day_gantt_chart WHERE id_gantt = $1', [g.id]);
                console.log(`Found ${day_gantts.rows.length} records`);
                if (day_gantts.rows.length > 0) console.log(day_gantts.rows.slice(0, 2));
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
