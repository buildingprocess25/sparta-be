const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkDb() {
  const res = await pool.query(`
    SELECT t.nomor_ulok, g.id as gantt_id, d.h_awal, d.h_akhir 
    FROM toko t 
    JOIN gantt_chart g ON t.id = g.id_toko 
    JOIN day_gantt_chart d ON g.id = d.id_gantt 
    WHERE t.nomor_ulok = 'Z001-2512-6969' 
    LIMIT 5;
  `);
  console.log(res.rows);
  pool.end();
}
checkDb();
