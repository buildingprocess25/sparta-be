const { pool } = require('./dist/db/pool');
async function run() {
    const res = await pool.query("SELECT nama_pt, email_sat FROM user_cabang WHERE email_sat = 'tunas.kalianda.indah@gmail.com'");
    console.log(res.rows);
    process.exit(0);
}
run();
