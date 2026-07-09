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
    const ulok = '2SZ1-2603-0001-R';
    const resToko = await pool.query('SELECT nomor_ulok, nama_toko, cabang, nama_kontraktor FROM toko WHERE nomor_ulok = $1', [ulok]);
    console.log('--- TOKO ---');
    console.log(resToko.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
