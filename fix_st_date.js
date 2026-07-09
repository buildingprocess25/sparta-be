const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../sparta-be.env') });
const url = new URL(process.env.DATABASE_URL);
const pool = new Pool({ host: url.hostname, port: parseInt(url.port), user: url.username, password: url.password, database: url.pathname.slice(1), ssl: { rejectUnauthorized: false } });

async function main() {
  // Tanggal opname final adalah 2026-06-17, set berkas ST ke tanggal yang sama
  const correctDate = '2026-06-17T08:34:50.000Z';

  const res = await pool.query(
    'UPDATE berkas_serah_terima SET created_at = $1 WHERE id = 368 RETURNING id, id_toko, created_at',
    [correctDate]
  );
  console.log('Updated berkas_serah_terima:', res.rows);
  pool.end();
}

main().catch(console.error);
