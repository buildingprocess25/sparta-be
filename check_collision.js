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
    const res = await pool.query(`
      WITH normalized_toko AS (
        SELECT DISTINCT nama_kontraktor as original,
               TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(nama_kontraktor), '\\y(pt|cv)\\y|[\\.,]', ' ', 'gi'), '\\s+', ' ', 'g')) as normalized
        FROM toko 
        WHERE nama_kontraktor IS NOT NULL
      )
      SELECT normalized, array_agg(original) as originals
      FROM normalized_toko
      GROUP BY normalized
      HAVING count(original) > 1
    `);
    console.log('--- POTENSI BENTROK (Data Toko) ---');
    console.log(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
