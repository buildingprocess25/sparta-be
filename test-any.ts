import { pool } from "./src/db/pool";
async function run() {
    const t0 = Date.now();
    const res = await pool.query("SELECT id FROM toko");
    const ids = res.rows.map(r => r.id);
    console.log(`Fetched ${ids.length} tokos in ${Date.now() - t0}ms`);
    
    const t1 = Date.now();
    await pool.query("SELECT * FROM gantt_chart WHERE id_toko = ANY($1::int[])", [ids]);
    console.log(`ANY(ids) took ${Date.now() - t1}ms`);

    const t2 = Date.now();
    await pool.query("SELECT * FROM gantt_chart");
    console.log(`No filter took ${Date.now() - t2}ms`);
    
    await pool.end();
}
run().catch(console.error);
