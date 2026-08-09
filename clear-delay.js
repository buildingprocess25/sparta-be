const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clearDelay() {
    try {
        const res = await pool.query(`UPDATE day_gantt_chart SET keterlambatan = NULL WHERE id = 8037`);
        console.log(`Updated ${res.rowCount} rows. keterlambatan cleared!`);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
clearDelay();
