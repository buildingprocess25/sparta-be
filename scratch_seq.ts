import { pool } from "./src/db/pool";

async function run() {
    try {
        const res = await pool.query(`
            SELECT last_value FROM rab_id_seq;
        `);
        const maxRes = await pool.query(`
            SELECT max(id) FROM rab;
        `);
        console.log({
            sequenceValue: res.rows[0].last_value,
            maxId: maxRes.rows[0].max
        });
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
