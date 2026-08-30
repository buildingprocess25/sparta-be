import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../sparta-be.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'pengawasan_gantt'
    `);
    console.log("--- COLUMNS IN pengawasan_gantt ---");
    console.log(res.rows);
    
    const res2 = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'pengajuan_spk'
    `);
    console.log("\n--- COLUMNS IN pengajuan_spk ---");
    console.log(res2.rows);

    const res3 = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'gantt_chart'
    `);
    console.log("\n--- COLUMNS IN gantt_chart ---");
    console.log(res3.rows);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

run();
