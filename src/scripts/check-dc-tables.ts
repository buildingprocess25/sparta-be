import { pool } from "../db/pool";

async function checkSchema() {
    try {
        const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dc_activity_log'`);
        console.log("dc_activity_log schema:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
