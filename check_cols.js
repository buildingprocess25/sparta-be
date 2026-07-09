const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const dCol = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'day_gantt_chart'");
    console.log('day_gantt_chart cols:', dCol.rows.map(r=>r.column_name).join(', '));
    const katCol = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'kategori_pekerjaan_gantt'");
    console.log('kategori_pekerjaan_gantt cols:', katCol.rows.map(r=>r.column_name).join(', '));
  } finally {
    await pool.end();
  }
}
main();
