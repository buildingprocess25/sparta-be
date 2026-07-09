const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../sparta-be.env') });
const url = new URL(process.env.DATABASE_URL);
const pool = new Pool({ host: url.hostname, port: parseInt(url.port), user: url.username, password: url.password, database: url.pathname.slice(1), ssl: { rejectUnauthorized: false } });

async function main() {
  // Cek opname_final untuk Sipil (id_toko=1226)
  const res = await pool.query('SELECT id, created_at FROM opname_final WHERE id_toko = 1226');
  console.log('Opname Final:', res.rows);

  // Cek berkas ST yang baru dibuat
  const res2 = await pool.query('SELECT id, id_toko, created_at FROM berkas_serah_terima WHERE id_toko = 1226');
  console.log('Berkas ST:', res2.rows);

  // Cek tanggal terakhir submit opname dari Excel (tanggal submit terakhir = 5/6/2026, 10.07.49 => 2026-06-05)
  // Cek juga di opname_item - kapan item dibuat
  const res3 = await pool.query('SELECT MAX(created_at) as last_item_date FROM opname_item WHERE id_opname_final = (SELECT id FROM opname_final WHERE id_toko = 1226 LIMIT 1)');
  console.log('Last opname item created_at:', res3.rows);

  // Cek kolom opname_final
  const res4 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'opname_final' ORDER BY ordinal_position");
  console.log('opname_final columns:', res4.rows.map(r => r.column_name).join(', '));

  pool.end();
}

main().catch(console.error);
