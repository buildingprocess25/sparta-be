import { pool } from "./src/db/pool";
async function run() {
    console.log("Starting test-seq");
    const client = await pool.connect();
    try {
        const t0 = Date.now();
        const tokoResult = await client.query("SELECT id FROM toko");
        const tokoIds = tokoResult.rows.map(r => r.id);
        
        console.log(`toko fetch: ${Date.now() - t0}ms, rows: ${tokoIds.length}`);
        
        const t1 = Date.now();
        const ganttResult = await client.query("SELECT id FROM gantt_chart WHERE id_toko = ANY($1::int[])", [tokoIds]);
        const ganttIds = ganttResult.rows.map(r => r.id);
        console.log(`gantt fetch: ${Date.now() - t1}ms, rows: ${ganttIds.length}`);

        const t2 = Date.now();
        await client.query("SELECT * FROM pengawasan_gantt WHERE id_gantt = ANY($1::int[])", [ganttIds]);
        console.log(`pengawasan_gantt fetch: ${Date.now() - t2}ms`);

        const t3 = Date.now();
        await client.query("SELECT * FROM pengawasan WHERE id_gantt = ANY($1::int[])", [ganttIds]);
        console.log(`pengawasan fetch: ${Date.now() - t3}ms`);
        
        const t4 = Date.now();
        await client.query("SELECT * FROM opname_item oi JOIN rab_item ri ON oi.id_rab = ri.id_rab WHERE oi.id_opname_final = ANY($1::int[])", [[1,2,3,4,5]]); // dummy
        console.log(`opname_item fetch: ${Date.now() - t4}ms`);

        console.log(`Total time: ${Date.now() - t0}ms`);
    } finally {
        client.release();
    }
    await pool.end();
}
run().catch(console.error);
