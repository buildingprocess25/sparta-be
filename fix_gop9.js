const { pool } = require('./src/config/database');
const { opnameFinalRepository } = require('./src/modules/opname-final/opname-final.repository');

async function fix() {
    try {
        const res = await pool.query(`
            SELECT ofn.id 
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE t.nomor_ulok = 'TZ01-2603-TC56-R'
        `);
        for (const row of res.rows) {
            console.log("Syncing opname final ID:", row.id);
            await opnameFinalRepository.syncGrandTotals(row.id);
            console.log("Synced ID:", row.id);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
fix();
