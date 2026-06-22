import { pool } from './src/db/pool';

async function check() {
    try {
        const res = await pool.query(`
            SELECT id, grand_total_opname, grand_total_rab, grand_total_final 
            FROM opname_final 
            WHERE id IN (59, 60)
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
