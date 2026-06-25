import { pool } from './src/db/pool';
async function main() {
    try {
        const result = await pool.query(`
            SELECT id, volume_akhir, jenis_pekerjaan 
            FROM opname_final_item 
            WHERE volume_akhir > 1000
        `);
        console.log('Result:', result.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
