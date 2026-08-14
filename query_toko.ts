import { config } from "dotenv";
config({ path: "../sparta-be.env" });
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const query = `
            SELECT nama_toko, kode_toko, cabang
            FROM toko
            WHERE nomor_ulok = 'Z001-1308-1512'
            LIMIT 1
        `;
        const res = await pool.query(query);
        console.log("Toko Record found:");
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

run();
