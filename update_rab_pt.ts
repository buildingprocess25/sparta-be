import { pool } from './src/db/pool';

async function main() {
    try {
        const res = await pool.query(
            `UPDATE rab SET nama_pt = $1 WHERE id = $2 RETURNING *`, 
            ['TES BERKAH JAYA ABADI, CV', '2440']
        );
        console.log("Updated rows:", res.rows.length);
        if (res.rows.length > 0) {
            console.log("New nama_pt:", res.rows[0].nama_pt);
        } else {
            console.log("RAB with ID 2440 not found.");
        }
    } catch (e) {
        console.error("Error updating RAB:", e);
    } finally {
        process.exit(0);
    }
}

main();
