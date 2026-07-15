import { pool } from './src/db/pool';

async function test() {
    const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'opname_item';`);
    console.log(res.rows);
    await pool.end();
}
test().catch(console.error);
