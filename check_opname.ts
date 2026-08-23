const { pool } = require('./src/db/pool');
async function run() {
  try {
    const res = await pool.query(`
      SELECT o.id, o.id_pengawasan_item, o.volume_akhir, o.total_selisih, o.desain, o.kualitas
      FROM opname_item o
      JOIN pengawasan p ON o.id_pengawasan_item = p.id
      JOIN gantt_chart g ON p.id_gantt = g.id
      JOIN toko t ON g.id_toko = t.id
      WHERE t.nomor_ulok = 'Z001-3007-0102-R'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
