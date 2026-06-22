import { pool } from "./src/db/pool";

async function run() {
    try {
        await pool.query(`ALTER TABLE instruksi_lapangan_item ADD COLUMN IF NOT EXISTS catatan TEXT`);
        console.log("Migration 'catatan' field added successfully to instruksi_lapangan_item.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        pool.end();
    }
}

run();
