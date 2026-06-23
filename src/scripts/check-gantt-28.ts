import { pool } from "../db/pool";

async function main() {
    try {
        // Find all rab IDs for toko 1480
        const rabIdsRes = await pool.query("SELECT id FROM rab WHERE id_toko = 1480");
        const rabIds = rabIdsRes.rows.map(r => r.id);
        console.log("RAB IDs for toko 1480:", rabIds);

        // Find how many items exist in rab_item for these rab IDs
        for (const rabId of rabIds) {
            const countForRab = await pool.query("SELECT COUNT(*) FROM rab_item WHERE id_rab = $1", [rabId]);
            console.log(`rab_items for id_rab ${rabId}:`, countForRab.rows[0].count);
        }

        // Check if there is another table for migrated rab items
        const tablesRes = await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
        );
        console.log("Tables in DB:", tablesRes.rows.map(r => r.table_name));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
