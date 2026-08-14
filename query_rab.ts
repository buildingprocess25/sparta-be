import { config } from "dotenv";
config({ path: "../sparta-be.env" });
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const query = `
            SELECT r.id, r.status, r.link_pdf_gabungan, r.link_pdf_non_sbo, r.link_pdf_rekapitulasi, r.link_pdf_sph, r.logo, r.file_asuransi, r.created_at
            FROM rab r
            JOIN toko t ON r.id_toko = t.id
            WHERE t.nomor_ulok = 'Z001-1308-1512'
            ORDER BY r.created_at DESC
            LIMIT 1
        `;
        const res = await pool.query(query);
        console.log("RAB Record found:");
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

run();
