const { pool } = require('./dist/db/pool');
async function main() {
  try {
    const res = await pool.query(`SELECT id, nomor_ulok, lingkup_pekerjaan FROM toko WHERE nomor_ulok = '2JZ1-2603-0003'`);
    console.log("Toko:", res.rows);
    if(res.rows.length > 0) {
      const tokoIds = res.rows.map(r => r.id);
      const opname = await pool.query(`SELECT * FROM opname_final WHERE id_toko = ANY($1::int[])`, [tokoIds]);
      console.log("Opname Final:", opname.rows);
      const serahTerima = await pool.query(`SELECT id, id_toko, link_pdf, created_at FROM berkas_serah_terima WHERE id_toko = ANY($1::int[])`, [tokoIds]);
      console.log("Berkas Serah Terima:", serahTerima.rows);
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
main();
