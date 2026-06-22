import { pool } from './src/db/pool';
import { opnameFinalRepository } from './src/modules/opname-final/opname-final.repository';

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
            await opnameFinalRepository.updateTotals(row.id);
            console.log("Synced ID:", row.id);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
fix();
