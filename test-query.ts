import { pool } from './src/db/pool';

async function testQuery() {
    const client = await pool.connect();
    try {
        const query = 
            SELECT kpg.id, kpg.kategori_pekerjaan
            FROM kategori_pekerjaan_gantt kpg
            WHERE kpg.id_gantt = 548
        ;
        const res = await client.query(query);
        console.table(res.rows);
    } finally {
        client.release();
        await pool.end();
    }
}
testQuery().catch(console.error);
