import { pool } from "./src/db/pool";

async function run() {
    console.time("Query Total");
    const tokoRes = await pool.query("SELECT id FROM toko ORDER BY id DESC");
    const ids = tokoRes.rows.map(r => r.id);
    const idArr = `{${ids.join(",")}}`;
    
    const rabRes = await pool.query(`SELECT id FROM rab WHERE id_toko = ANY($1::int[])`, [idArr]);
    const rabIds = rabRes.rows.map(r => r.id);
    const rabArr = `{${rabIds.join(",")}}`;
    
    console.time("Aggregation");
    const res = await pool.query(`
        SELECT id_rab, 
               SUM(CASE WHEN UPPER(kategori_pekerjaan) = 'PEKERJAAN AREA TERBUKA' THEN total_harga ELSE 0 END) as cost_terbuka,
               SUM(CASE WHEN UPPER(kategori_pekerjaan) = 'PEKERJAAN BEANSPOT' THEN total_harga ELSE 0 END) as cost_beanspot,
               SUM(CASE WHEN UPPER(kategori_pekerjaan) NOT IN ('PEKERJAAN AREA TERBUKA', 'PEKERJAAN BEANSPOT') THEN total_harga ELSE 0 END) as cost_bangunan
        FROM rab_item 
        WHERE id_rab = ANY($1::int[]) 
        GROUP BY id_rab
    `, [rabArr]);
    console.timeEnd("Aggregation");
    
    console.log(`Returned ${res.rows.length} rows`);
    console.log(res.rows[0]);
    
    await pool.end();
}
run().catch(console.error);
