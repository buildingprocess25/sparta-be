const { pool } = require('../../db/pool');

async function checkData() {
  try {
    const res = await pool.query(`
      SELECT g.id as id_gantt, g.id_toko, p.tanggal_pengawasan
      FROM pengawasan_gantt p
      JOIN gantt_chart g ON g.id = p.id_gantt
      WHERE g.id_toko IN (2482, 2489)
      ORDER BY g.id_toko, p.tanggal_pengawasan
    `);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
checkData();
