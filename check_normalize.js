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
    const resToko = await pool.query(`
      SELECT DISTINCT nama_kontraktor,
             TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(nama_kontraktor), '\\y(pt|cv)\\y|[\\.,]', ' ', 'g'), '\\s+', ' ', 'g')) as normalized
      FROM toko 
      WHERE nama_kontraktor IS NOT NULL 
      LIMIT 10
    `);
    console.log('--- NORMALISASI TOKO ---');
    console.log(resToko.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
