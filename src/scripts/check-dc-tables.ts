import { pool } from "../db/pool";

async function checkSchema() {
    try {
        const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dc_document_version'`);
        console.log("dc_document_version schema:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
