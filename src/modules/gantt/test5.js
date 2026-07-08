const { pool } = require('../../db/pool');

async function checkPic() {
  try {
    const res = await pool.query(`
      SELECT t.id, t.nomor_ulok, t.lingkup_pekerjaan, t.cabang, 
             p.id as pic_id, p.plc_building_support, p.kategori_lokasi
      FROM toko t
      LEFT JOIN pic_pengawasan p ON p.id_toko = t.id
      WHERE t.nomor_ulok = 'LZ01-2606-0004'
    `);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
checkPic();
