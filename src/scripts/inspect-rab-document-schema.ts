import { pool } from '../db/pool';
async function main() {
 const c = await pool.connect();
 try {
  await c.query('BEGIN READ ONLY');
  const schema = await c.query(`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND (table_name IN ('rab','toko') OR table_name LIKE 'rab%item%') ORDER BY table_name,ordinal_position`);
  console.log(JSON.stringify({schema:schema.rows}));
  const examples = await c.query(`SELECT r.id,r.id_toko,r.status,r.grand_total,r.grand_total_non_sbo,r.grand_total_final,t.nomor_ulok,t.lingkup_pekerjaan,t.cabang FROM rab r JOIN toko t ON t.id=r.id_toko WHERE t.nomor_ulok IN ('Z001-0709-3333','Z001-0907-1111') ORDER BY t.nomor_ulok,t.lingkup_pekerjaan,r.id DESC`);
  console.log(JSON.stringify({examples:examples.rows}));
  await c.query('ROLLBACK');
 } finally {c.release();await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
