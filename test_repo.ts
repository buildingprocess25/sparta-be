import { pool } from './src/db/pool';
async function test() {
    const res = await pool.query(`SELECT COUNT(*) FROM toko WHERE cabang = 'HEAD OFFICE'`);
    console.log("HEAD OFFICE COUNT:", res.rows[0]);
    await pool.end();
}
test().catch(err => { console.error(err); process.exit(1); });
