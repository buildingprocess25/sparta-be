const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const res = await pool.query("SELECT * FROM dependency_gantt WHERE id_gantt = 538");
    console.log('Deps 538 (ME):', res.rows.length);

    const checkAll = await pool.query("SELECT id_gantt, COUNT(*) as c FROM dependency_gantt GROUP BY id_gantt ORDER BY id_gantt DESC LIMIT 5");
    console.log('Recent deps:', checkAll.rows);

  } finally {
    await pool.end();
  }
}
main();
