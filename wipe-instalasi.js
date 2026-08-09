const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function wipe() {
    try {
        const res = await pool.query(`DELETE FROM pengawasan WHERE id_gantt=550 AND kategori_pekerjaan='INSTALASI'`);
        console.log(`Deleted ${res.rowCount} injected INSTALASI records!`);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
wipe();
