import { pool } from "./src/db/pool";
import fs from "fs";
import path from "path";

async function runMigration() {
    const sqlPath = path.join(__dirname, "sql", "2026-05-11-normalize-projek-planning.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    try {
        await pool.query("BEGIN");
        await pool.query(sql);
        await pool.query("COMMIT");
        console.log("Migration executed successfully!");
    } catch (e) {
        await pool.query("ROLLBACK");
        console.error("Migration failed:", e);
    } finally {
        process.exit(0);
    }
}

runMigration();
