const { Client } = require('pg');
require('dotenv').config();

async function run() {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/sparta_dev" });
    await pgClient.connect();
    try {
        const updateArgs = ["Selesai", "Sistem: Pre-inspeksi Takeover", 1, "Persiapan", null];
        const updateRes = await pgClient.query(
            `UPDATE pengawasan
             SET status = $1, catatan = $2
             WHERE id_gantt = $3 AND kategori_pekerjaan = $4 AND (jenis_pekerjaan = $5 OR (jenis_pekerjaan IS NULL AND $5 IS NULL))
             RETURNING id`,
            updateArgs
        );
        console.log("Success:", updateRes.rows);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await pgClient.end();
    }
}
run();
