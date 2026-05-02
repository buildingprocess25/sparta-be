import { Pool, type PoolClient } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    keepAlive: env.PG_KEEP_ALIVE,
    connectionTimeoutMillis: env.PG_CONN_TIMEOUT_MS,
    idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS
});

pool.on("error", (error) => {
    console.error("Postgres pool error:", error);
});

export const withTransaction = async <T>(
    executor: (client: PoolClient) => Promise<T>
): Promise<T> => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await executor(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
