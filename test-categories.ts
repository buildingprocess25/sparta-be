import { pool } from './src/db/pool';

async function test() {
    const res = await pool.query(`SELECT UPPER(kategori_pekerjaan) as kat, COUNT(*) FROM rab_item GROUP BY UPPER(kategori_pekerjaan) LIMIT 20;`);
    console.log(res.rows);
    await pool.end();
}
test().catch(console.error);
