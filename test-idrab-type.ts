import { pool } from './src/db/pool';

async function test() {
    const res = await pool.query(`SELECT id_rab FROM rab_item LIMIT 1`);
    console.log(typeof res.rows[0].id_rab, res.rows[0].id_rab);
    await pool.end();
}
test().catch(console.error);
