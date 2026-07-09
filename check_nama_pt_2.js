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
    const email = 'FATURRACHMAN.PAKAYA@SAT.CO.ID'.toLowerCase();
    const resUser = await pool.query('SELECT email_sat, nama_pt FROM user_cabang WHERE LOWER(email_sat) = $1', [email]);
    console.log('--- USER_CABANG ---');
    console.log(resUser.rows);

    const pt = resUser.rows[0]?.nama_pt;
    if (pt) {
        console.log('\n--- MENCARI TOKO MIRIP DENGAN: ' + pt + ' ---');
        // Let's strip out common words like PT, CV, ., , and see what matches
        const baseName = pt.replace(/(PT|CV|\.|,)/gi, '').trim().toLowerCase().split(' ')[0]; // Ambil kata pertama
        
        const resToko = await pool.query(`SELECT DISTINCT nama_kontraktor FROM toko WHERE LOWER(nama_kontraktor) LIKE $1 LIMIT 20`, [`%${baseName}%`]);
        console.log(resToko.rows.map(r => r.nama_kontraktor));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
