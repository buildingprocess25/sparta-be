import { pool } from "../db/pool";

async function run() {
    const cols = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'instruksi_lapangan_item' ORDER BY ordinal_position`
    );
    console.log('=== instruksi_lapangan_item columns ===');
    console.log(cols.rows);

    const sample = await pool.query(
        `SELECT id, catatan FROM instruksi_lapangan_item LIMIT 10`
    );
    console.log('=== sample catatan values ===');
    console.log(sample.rows);

    process.exit(0);
}
run().catch(console.error);
