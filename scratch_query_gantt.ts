import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../sparta-be.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const toko = await pool.query('SELECT * FROM toko WHERE id = $1', [29780]);
    console.log('--- TOKO ---');
    console.log(toko.rows);
    
    if (toko.rows.length > 0) {
        const nomor_ulok = toko.rows[0].nomor_ulok;
        console.log('--- GANTT BY NOMOR ULOK ---');
        const gantts = await pool.query('SELECT * FROM gantt_chart WHERE nomor_ulok = $1', [nomor_ulok]);
        console.log(gantts.rows);
        
        console.log('--- DAY GANTT CHART BY ID_TOKO ---');
        const day_gantts = await pool.query('SELECT * FROM day_gantt_chart WHERE id_toko = $1', [29780]);
        console.log(`Found ${day_gantts.rows.length} records`);
        if (day_gantts.rows.length > 0) console.log(day_gantts.rows.slice(0, 5));
        
        console.log('--- PENGAWASAN GANTT BY ID_TOKO ---');
        const p_gantt = await pool.query('SELECT * FROM pengawasan_gantt WHERE id_toko = $1', [29780]);
        console.log(`Found ${p_gantt.rows.length} records`);
        if (p_gantt.rows.length > 0) console.log(p_gantt.rows);
        
        console.log('--- PENGAJUAN SPK BY ID_TOKO ---');
        const spk = await pool.query('SELECT * FROM pengajuan_spk WHERE id_toko = $1', [29780]);
        console.log(`Found ${spk.rows.length} records`);
        if (spk.rows.length > 0) console.log(spk.rows);
        
        console.log('--- RAB BY ID_TOKO ---');
        const rab = await pool.query('SELECT * FROM rab WHERE id_toko = $1', [29780]);
        console.log(`Found ${rab.rows.length} records`);
        if (rab.rows.length > 0) console.log(rab.rows);
    }

  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

run();
