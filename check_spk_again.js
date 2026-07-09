const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const spk = await pool.query("SELECT id, id_toko, nomor_ulok, lingkup_pekerjaan FROM pengajuan_spk WHERE id_toko IN (1867, 1873)");
    console.log('SPK 2605:', spk.rows);
  } finally {
    await pool.end();
  }
}
main();
