import { pool } from "./src/db/pool";

async function run() {
    try {
        const users = await pool.query(`
            SELECT * FROM user_cabang 
            WHERE nama_pt = 'NAMA PT TIDAK DITEMUKAN'
        `);
        console.log("Users with NAMA PT TIDAK DITEMUKAN:", users.rows.length);

        const rabs = await pool.query(`
            SELECT t.nama_kontraktor, t.nomor_ulok
            FROM toko t
            WHERE t.nama_kontraktor = 'NAMA PT TIDAK DITEMUKAN'
        `);
        console.log("Tokos with NAMA PT TIDAK DITEMUKAN:", rabs.rows.length);
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
