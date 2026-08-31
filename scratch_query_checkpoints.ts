import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../sparta-be.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const p = await pool.query(`
        SELECT *
        FROM pengawasan
        WHERE id_gantt = 1903 AND jenis_pekerjaan ILIKE '%hanger%'
    `);
    console.log(p.rows);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

run();
