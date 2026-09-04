import { config } from 'dotenv';
config({ path: '../sparta-be.env' });
config({ path: '.env' });
import { pool } from './src/db/pool';

async function check() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'toko'
    `);
    console.log(res.rows.map(r => r.column_name));
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await pool.end();
  }
}
check();
