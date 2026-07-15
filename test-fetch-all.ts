import { pool } from "./src/db/pool";
async function run() {
    const t0 = Date.now();
    const res = await pool.query("SELECT * FROM pengawasan");
    console.log(`Fetched ${res.rows.length} pengawasan in ${Date.now() - t0}ms`);
    await pool.end();
}
run().catch(console.error);
