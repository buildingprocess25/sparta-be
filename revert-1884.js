const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function revertBackfill() {
    await pool.query('BEGIN');
    try {
        console.log('=== ME-REVERT DATA BACKFILL ===');
        const res = await pool.query(`
            DELETE FROM pengawasan 
            WHERE id_pengawasan_gantt = 899 AND status = 'progress'
            RETURNING id
        `);
        console.log(`Berhasil menghapus ${res.rowCount} baris yang baru disuntikkan.`);
        await pool.query('COMMIT');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error(e);
    } finally {
        pool.end();
    }
}
revertBackfill();
