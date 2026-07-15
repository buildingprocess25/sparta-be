import { pool } from './src/db/pool';

async function test() {
    const res1 = await pool.query(`
        SELECT 
            SUM(CASE WHEN UPPER(kategori_pekerjaan) = 'PEKERJAAN AREA TERBUKA' THEN total_harga ELSE 0 END) as cost_terbuka,
            SUM(CASE WHEN UPPER(kategori_pekerjaan) = 'PEKERJAAN BEANSPOT' THEN total_harga ELSE 0 END) as cost_beanspot,
            SUM(CASE WHEN UPPER(kategori_pekerjaan) NOT IN ('PEKERJAAN AREA TERBUKA', 'PEKERJAAN BEANSPOT') THEN total_harga ELSE 0 END) as cost_bangunan
        FROM rab_item;
    `);
    console.log('Original SUM(total_harga):', res1.rows[0]);
    await pool.end();
}
test().catch(console.error);
