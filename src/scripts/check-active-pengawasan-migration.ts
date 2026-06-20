import { pool } from "../db/pool";

const main = async (): Promise<void> => {
    const active = await pool.query(`
        SELECT pid, state, wait_event_type, wait_event,
               now() - query_start AS duration,
               LEFT(query, 180) AS query
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND state <> 'idle'
        ORDER BY query_start
    `);
    console.log(JSON.stringify(active.rows, null, 2));
};

main().finally(async () => pool.end());
