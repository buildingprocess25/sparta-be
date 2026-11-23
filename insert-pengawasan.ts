import { pool } from './src/db/pool';

async function execute() {
  try {
    const existing = await pool.query(`SELECT id_pic_pengawasan FROM pengawasan_gantt WHERE id_gantt = 578 LIMIT 1`);
    const idPic = existing.rows[0].id_pic_pengawasan;

    await pool.query(`
      INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan, id_pic_pengawasan)
      VALUES (578, '10/08/2026', $1)
    `, [idPic]);

    console.log("Berhasil menambahkan tanggal pengawasan 10/08/2026 untuk ME (gantt_id: 578)");
  } catch (error) {
    console.error("Gagal insert:", error);
  } finally {
    pool.end();
  }
}

execute();
