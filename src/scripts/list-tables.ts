import { pool } from "../db/pool";

async function run() {
    // Find all relevant tables
    const r = await pool.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname='public' 
        AND (tablename LIKE '%serah%' OR tablename LIKE '%opname%' OR tablename LIKE '%pengawasan%' OR tablename LIKE '%gantt%')
        ORDER BY tablename
    `);
    console.log(r.rows.map((row: any) => row.tablename));
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
