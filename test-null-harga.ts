import { pool } from './src/db/pool';

async function test() {
    const res2 = await pool.query(`
        SELECT 
            SUM(CASE WHEN UPPER(kategori_pekerjaan) = 'PEKERJAAN AREA TERBUKA' THEN 
                COALESCE(total_harga, (CAST(NULLIF(volume, '') AS numeric) * (CAST(NULLIF(harga_material, '') AS numeric) + CAST(NULLIF(harga_upah, '') AS numeric))), 0) 
            ELSE 0 END) as cost_terbuka,
            SUM(CASE WHEN UPPER(kategori_pekerjaan) = 'PEKERJAAN BEANSPOT' THEN 
                COALESCE(total_harga, (CAST(NULLIF(volume, '') AS numeric) * (CAST(NULLIF(harga_material, '') AS numeric) + CAST(NULLIF(harga_upah, '') AS numeric))), 0) 
            ELSE 0 END) as cost_beanspot,
            SUM(CASE WHEN UPPER(kategori_pekerjaan) NOT IN ('PEKERJAAN AREA TERBUKA', 'PEKERJAAN BEANSPOT') THEN 
                COALESCE(total_harga, (CAST(NULLIF(volume, '') AS numeric) * (CAST(NULLIF(harga_material, '') AS numeric) + CAST(NULLIF(harga_upah, '') AS numeric))), 0) 
            ELSE 0 END) as cost_bangunan
        FROM rab_item;
    `);
    console.log('With COALESCE and CAST:', res2.rows[0]);
    
    await pool.end();
}
test().catch(console.error);
