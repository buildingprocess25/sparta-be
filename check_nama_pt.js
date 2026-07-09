require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be.env' });
const { Pool } = require('pg');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false }
  });

  try {
    const resToko = await pool.query('SELECT DISTINCT nama_kontraktor FROM toko WHERE nama_kontraktor IS NOT NULL LIMIT 20');
    console.log('--- NAMA_KONTRAKTOR di Tabel TOKO ---');
    console.log(resToko.rows.map(r => r.nama_kontraktor));

    const resUser = await pool.query('SELECT DISTINCT nama_pt FROM user_cabang WHERE nama_pt IS NOT NULL LIMIT 20');
    console.log('\n--- NAMA_PT di Tabel USER_CABANG ---');
    console.log(resUser.rows.map(r => r.nama_pt));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
