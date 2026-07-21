import { Pool, type PoolClient, types } from "pg";
import { env } from "../config/env";

// Kembalikan tipe date & timestamp sebagai string mentah (bukan JS Date)
// sehingga tidak terjadi konversi timezone UTC yang tidak diinginkan.
types.setTypeParser(1082, (val: string) => val);          // date
types.setTypeParser(1114, (val: string) => val);          // timestamp without timezone
types.setTypeParser(1184, (val: string) => val);          // timestamp with timezone

type PgSslConfig = false | { rejectUnauthorized: boolean };

const parseDatabaseUrl = (rawUrl: string): URL => {
    const parsed = new URL(rawUrl);
    return parsed;
};

const buildConnectionString = (rawUrl: string): string => {
    const parsed = parseDatabaseUrl(rawUrl);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("ssl");
    return parsed.toString();
};

const buildSslConfig = (rawUrl: string): PgSslConfig => {
    const parsed = parseDatabaseUrl(rawUrl);
    const sslMode = (process.env.PGSSLMODE || parsed.searchParams.get("sslmode") || "require").trim().toLowerCase();

    if (sslMode === "disable") return false;
    if (sslMode === "verify-full" || sslMode === "verify-ca") return { rejectUnauthorized: true };
    return { rejectUnauthorized: false };
};

const pgPoolMax = Math.min(Math.max(env.PG_POOL_MAX, 5), 20);

export const pool = new Pool({
    connectionString: buildConnectionString(env.DATABASE_URL),
    ssl: buildSslConfig(env.DATABASE_URL),
    max: pgPoolMax,
    keepAlive: env.PG_KEEP_ALIVE,
    connectionTimeoutMillis: env.PG_CONN_TIMEOUT_MS,
    idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS
});

console.log(`[Postgres] Pool max efektif: ${pgPoolMax}`);

// Setiap koneksi baru: set timezone ke WIB
pool.on("connect", (client) => {
    client.query("SET TIME ZONE 'Asia/Jakarta'").catch(() => {});
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
