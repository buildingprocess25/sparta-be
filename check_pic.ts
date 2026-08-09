import { pool } from "./src/db/pool.ts";

async function run() {
    try {
        const noPic = await pool.query(`
            SELECT t.nomor_ulok, t.nama_toko, t.cabang 
            FROM toko t 
            LEFT JOIN pic_pengawasan p ON p.id_toko = t.id 
            WHERE p.id IS NULL 
            LIMIT 20
        `);
        console.log(JSON.stringify(noPic.rows, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
