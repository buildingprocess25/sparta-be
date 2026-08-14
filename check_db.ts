import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";

const envPath = path.resolve(__dirname, "../sparta-be.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error("No env file found at", envPath);
}

import { pool } from "./src/db/pool";

async function checkDb() {
    try {
        console.log("=== Checking Table: toko (Cabang Analysis) ===");
        const tokoRes = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN cabang IS NULL OR cabang = '' THEN 1 ELSE 0 END) as cabang_null FROM toko");
        console.log("Table 'toko' summary:", tokoRes.rows[0]);

        console.log("\n=== Checking Sample Rows: toko ===");
        const tokoSample = await pool.query("SELECT id, nomor_ulok, nama_toko, kode_toko, proyek, cabang FROM toko LIMIT 5");
        console.table(tokoSample.rows);

        console.log("\n=== Checking Cabang Distinct Values ===");
        const distinctCabang = await pool.query("SELECT cabang, COUNT(*) as count FROM toko GROUP BY cabang ORDER BY count DESC");
        console.table(distinctCabang.rows);

    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        await pool.end();
    }
}

checkDb();
