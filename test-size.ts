import { pool } from "./src/db/pool";
async function run() {
    const res = await pool.query("SELECT SUM(pg_column_size(dokumentasi)) as size FROM pengawasan");
    console.log(`Dokumentasi size: ${res.rows[0].size} bytes`);
    
    const res2 = await pool.query("SELECT COUNT(*) FROM pengawasan");
    console.log(`Pengawasan rows: ${res2.rows[0].count}`);
    await pool.end();
}
run().catch(console.error);
