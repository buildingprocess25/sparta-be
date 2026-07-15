import { pool } from "./src/db/pool";

async function run() {
    // Kill idle connections only for our own role (non-superuser safe)
    const res = await pool.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE state = 'idle'
          AND pid <> pg_backend_pid()
          AND usename = current_user
    `);
    console.log(`Killed ${res.rowCount} idle connections`);
    await pool.end();
}
run().catch(console.error);
