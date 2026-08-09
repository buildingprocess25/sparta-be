import { pool } from "./src/db/pool";

async function run() {
    try {
        const users = await pool.query(`
            SELECT * FROM user_cabang 
            WHERE email_sat = 'garudamaspermata@gmail.com'
        `);
        console.log("Users:", JSON.stringify(users.rows, null, 2));

        const toko = await pool.query(`
            SELECT * FROM toko 
            WHERE nama_kontraktor = 'NAMA PT TIDAK DITEMUKAN'
            LIMIT 2
        `);
        console.log("Toko:", JSON.stringify(toko.rows, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
