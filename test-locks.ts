import { pool } from "./src/db/pool";
async function run() {
    const res = await pool.query("SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle'");
    console.table(res.rows);
    await pool.end();
}
run().catch(console.error);
