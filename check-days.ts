import { pool } from './src/db/pool';
async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(
            SELECT kpg.kategori_pekerjaan, COUNT(dgc.id) as days_count
            FROM kategori_pekerjaan_gantt kpg
            LEFT JOIN day_gantt_chart dgc ON dgc.kategori_pekerjaan_gantt_id = kpg.id
            WHERE kpg.id_gantt IN (1436, 1438) 
              AND kpg.kategori_pekerjaan ILIKE '%[IL]%'
            GROUP BY kpg.kategori_pekerjaan
        );
        console.table(res.rows);
    } finally {
        client.release();
        await pool.end();
    }
}
check().catch(console.error);
