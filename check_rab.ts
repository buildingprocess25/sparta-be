import { pool } from "./src/db/pool";

async function run() {
    try {
        const rabs = await pool.query(`
            SELECT id, email_pembuat, nama_pt, id_toko 
            FROM rab 
            WHERE id_toko IN (1422, 1439)
        `);
        console.log("RABs:", JSON.stringify(rabs.rows, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
