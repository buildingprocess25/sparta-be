import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../sparta-be.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const id_toko = 2970;
    console.log(`--- TOKO ---`);
    const toko = await pool.query('SELECT * FROM toko WHERE id = $1', [id_toko]);
    console.log(toko.rows);
    
    console.log('--- GANTT BY ID_TOKO ---');
    const gantts = await pool.query('SELECT * FROM gantt_chart WHERE id_toko = $1', [id_toko]);
    console.log(`Found ${gantts.rows.length} gantt records`);
    console.log(gantts.rows);
    
    for (const g of gantts.rows) {
        console.log(`--- DAY GANTT CHART BY ID_GANTT ${g.id} ---`);
        const day_gantts = await pool.query('SELECT * FROM day_gantt_chart WHERE id_gantt = $1', [g.id]);
        console.log(`Found ${day_gantts.rows.length} day records`);
        if (day_gantts.rows.length > 0) console.log(day_gantts.rows.slice(0, 2));
        
        console.log(`--- PENGAWASAN GANTT BY ID_GANTT ${g.id} ---`);
        const p_gantt = await pool.query('SELECT * FROM pengawasan_gantt WHERE id_gantt = $1', [g.id]);
        console.log(`Found ${p_gantt.rows.length} pengawasan_gantt records`);
        if (p_gantt.rows.length > 0) console.log(p_gantt.rows);
    }
    
    console.log('--- PENGAJUAN SPK BY ID_TOKO ---');
    const spk = await pool.query('SELECT * FROM pengajuan_spk WHERE id_toko = $1', [id_toko]);
    console.log(`Found ${spk.rows.length} SPK records`);
    if (spk.rows.length > 0) console.log(spk.rows);

  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

run();
