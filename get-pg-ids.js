const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res = await pool.query(`SELECT id, tanggal_pengawasan FROM pengawasan_gantt WHERE id_gantt = 550 ORDER BY to_date(tanggal_pengawasan, 'DD/MM/YYYY')`);
    console.log(res.rows);
    pool.end();
}
check();
