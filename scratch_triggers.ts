import { pool } from "./src/db/pool";

async function run() {
    try {
        const res = await pool.query(`
            SELECT tgname, pg_get_triggerdef(oid) 
            FROM pg_trigger 
            WHERE tgrelid = 'rab'::regclass;
        `);
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
