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
    const resUser = await pool.query('SELECT email_sat, nama_pt, jabatan FROM user_cabang WHERE LOWER(nama_pt) LIKE $1', ['%erka%']);
    console.log('--- USER_CABANG (ERKA) ---');
    console.log(resUser.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
