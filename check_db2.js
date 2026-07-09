const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const deps = await pool.query("SELECT * FROM dependency_gantt WHERE id_gantt = 584");
    console.log('Dependencies 584:', deps.rows);

    const picCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pic_pengawasan'");
    console.log('PIC Cols:', picCols.rows.map(r=>r.column_name).join(', '));
    const pic = await pool.query("SELECT id, id_toko, nomor_ulok FROM pic_pengawasan WHERE id_toko = 1867");
    console.log('PIC 1867:', pic.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
