const { pool } = require('../../db/pool');

async function test() {
  try {
    const res = await pool.query(`SELECT id, nomor_ulok, nama_toko, cabang, lingkup_pekerjaan FROM toko WHERE nomor_ulok IN ('1VZ1-2606-0004', 'LZ01-2606-0004')`);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
test();
