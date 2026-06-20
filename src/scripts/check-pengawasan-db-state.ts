import { pool } from "../db/pool";

const main = async (): Promise<void> => {
    const [columns, activity] = await Promise.all([
        pool.query(`
            SELECT table_name, column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND character_maximum_length = 1000
            ORDER BY table_name, ordinal_position
        `),
        pool.query(`
            SELECT pid, state, wait_event_type, wait_event,
                   now() - query_start AS duration,
                   LEFT(query, 240) AS query
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND state <> 'idle'
            ORDER BY query_start
        `)
    ]);
    console.log(JSON.stringify({
        varchar_1000_columns: columns.rows,
        active_queries: activity.rows
    }, null, 2));
};

main().finally(async () => pool.end());
