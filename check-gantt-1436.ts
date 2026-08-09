import { pool } from './src/db/pool';

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(
            SELECT kpg.id, kpg.kategori_pekerjaan, dgc.id as dgc_id, dgc.h_awal, dgc.h_akhir
            FROM kategori_pekerjaan_gantt kpg
            LEFT JOIN day_gantt_chart dgc ON dgc.id_kategori_pekerjaan_gantt = kpg.id
            WHERE kpg.id_gantt = 1436
        );
        console.table(res.rows);
    } finally {
        client.release();
        await pool.end();
    }
}
check();
