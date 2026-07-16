import { pool } from "./src/db/pool";

async function run() {
    try {
        const result = await pool.query("DELETE FROM denda_keterlambatan_action");
        console.log(`Deleted ${result.rowCount} rows from denda_keterlambatan_action`);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
