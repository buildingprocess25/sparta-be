import { pool } from './src/db/pool';
async function main() {
    try {
        const result = await pool.query(`
            SELECT id, email_pembuat, volume_akhir, jenis_pekerjaan, approval_status 
            FROM opname_final 
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
