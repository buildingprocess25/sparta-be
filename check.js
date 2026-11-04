
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/sparta_v2' });
async function check() {
  const res = await pool.query(\SELECT oi.id, oi.status, oi.foto FROM opname_item oi JOIN opname_final ofin ON ofin.id = oi.id_opname_final JOIN toko t ON t.id = ofin.id_toko WHERE t.nomor_ulok = 'Z001-1309-6666'\);
  console.log(res.rows.slice(0, 5));
  pool.end();
}
check();

