import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "c:/alfamart/SPARTA/sparta-be/.env" });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function main() {
    try {
        const idGantt = 1695; // Z001-3007-0102-R
        
        console.log("Mengecek pengawasan untuk gantt 1695...");
        
        const result = await pool.query(`
            SELECT id, jenis_pekerjaan, status, dokumentasi, tanggal_pengawasan 
            FROM pengawasan 
            WHERE id_gantt = $1
            ORDER BY id DESC
            LIMIT 25
        `, [idGantt]);
        
        console.log(`Ditemukan ${result.rows.length} record terbaru:`);
        for (const row of result.rows) {
            console.log(`- [${new Date(row.tanggal_pengawasan).toISOString().split('T')[0]}] ${row.jenis_pekerjaan}: ${row.status} | Dokumen: ${row.dokumentasi ? 'ADA' : 'KOSONG'}`);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
