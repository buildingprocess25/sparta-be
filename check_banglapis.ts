import { pool } from "./src/db/pool";

async function run() {
    try {
        const rabQuery = await pool.query(`
            SELECT DISTINCT nama_pt 
            FROM rab 
            WHERE email_pembuat = 'banglapis00@gmail.com' AND nama_pt != 'NAMA PT TIDAK DITEMUKAN'
        `);
        console.log("Other PTs for banglapis00:", rabQuery.rows);

        const tokoQuery = await pool.query(`
            SELECT DISTINCT t.nama_kontraktor 
            FROM toko t
            JOIN rab r ON r.id_toko = t.id
            WHERE r.email_pembuat = 'banglapis00@gmail.com' AND t.nama_kontraktor != 'NAMA PT TIDAK DITEMUKAN'
        `);
        console.log("Other Toko PTs for banglapis00:", tokoQuery.rows);
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
