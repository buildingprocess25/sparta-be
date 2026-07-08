const { pool } = require('../../db/pool');

async function check() {
  try {
    const res = await pool.query("SELECT id, id_toko, nomor_ulok, lingkup_pekerjaan, status FROM pengajuan_spk WHERE nomor_ulok IN ('1VZ1-2606-0004', 'LZ01-2606-0004')");
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
check();
