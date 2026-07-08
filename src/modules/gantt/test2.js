const { pool } = require('../../db/pool');

async function test() {
  try {
    const res = await pool.query(`
      SELECT 
        'gantt_chart' as tbl, id_toko, count(*) as c 
      FROM gantt_chart WHERE id_toko IN (2482, 2478, 2489) GROUP BY id_toko
      UNION ALL
      SELECT 
        'pengajuan_spk', id_toko, count(*) 
      FROM pengajuan_spk WHERE id_toko IN (2482, 2478, 2489) GROUP BY id_toko
      UNION ALL
      SELECT 
        'pic_pengawasan', id_toko, count(*) 
      FROM pic_pengawasan WHERE id_toko IN (2482, 2478, 2489) GROUP BY id_toko
    `);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
test();
