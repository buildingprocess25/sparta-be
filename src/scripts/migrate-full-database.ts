import { config } from "dotenv";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawn } from "child_process";
import { Client } from "pg";

config();

type PgEnvOptions = {
    url: string;
    sslMode?: string;
};

type CountRow = {
    table_name: string;
    row_count: string;
};

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Environment ${name} wajib diisi.`);
    }
    return value;
}

function buildPgEnv(input: PgEnvOptions): NodeJS.ProcessEnv {
    const parsed = new URL(input.url);
    const database = parsed.pathname.replace(/^\//, "");

    if (!database) {
        throw new Error("Nama database tidak ditemukan pada connection string.");
    }

    return {
        ...process.env,
        PGHOST: parsed.hostname,
        PGPORT: parsed.port || "5432",
        PGDATABASE: decodeURIComponent(database),
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
        PGSSLMODE: input.sslMode || parsed.searchParams.get("sslmode") || "prefer"
    };
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            env,
            stdio: ["ignore", "inherit", "inherit"],
            shell: false
        });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} keluar dengan kode ${code}`));
        });
    });
}

function pgCommand(command: "pg_dump" | "psql"): string {
    const binDir = process.env.PG_BIN_DIR?.trim();
    if (!binDir) return command;
    return join(binDir, process.platform === "win32" ? `${command}.exe` : command);
}

function normalizeDatabaseIdentity(url: string): string {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, "");
    return [
        parsed.hostname.toLowerCase(),
        parsed.port || "5432",
        decodeURIComponent(database),
        decodeURIComponent(parsed.username)
    ].join("|");
}

function buildClient(url: string, sslMode: string): Client {
    return new Client({
        connectionString: url,
        ssl: sslMode === "disable" ? false : { rejectUnauthorized: false }
    });
}

function quoteIdentifier(value: string): string {
    return `"${value.replace(/"/g, "\"\"")}"`;
}

async function readTableCounts(url: string, sslMode: string, schemaName: string): Promise<Map<string, string>> {
    const client = buildClient(url, sslMode);
    await client.connect();

    try {
        const tables = await client.query<{ table_name: string }>(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            `,
            [schemaName]
        );

        const counts = new Map<string, string>();
        for (const { table_name: tableName } of tables.rows) {
            const result = await client.query<CountRow>(
                `SELECT $1::text AS table_name, COUNT(*)::text AS row_count FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`,
                [tableName]
            );
            counts.set(tableName, result.rows[0].row_count);
        }
        return counts;
    } finally {
        await client.end();
    }
}

async function verifyRowCounts(sourceUrl: string, targetUrl: string, sourceSslMode: string, targetSslMode: string, schemaName: string) {
    console.log("Memverifikasi jumlah row source vs target...");

    const [sourceCounts, targetCounts] = await Promise.all([
        readTableCounts(sourceUrl, sourceSslMode, schemaName),
        readTableCounts(targetUrl, targetSslMode, schemaName)
    ]);

    const mismatches: string[] = [];
    const allTables = new Set([...sourceCounts.keys(), ...targetCounts.keys()]);

    for (const tableName of [...allTables].sort()) {
        const sourceCount = sourceCounts.get(tableName) ?? "0";
        const targetCount = targetCounts.get(tableName) ?? "0";
        if (sourceCount !== targetCount) {
            mismatches.push(`${tableName}: source=${sourceCount}, target=${targetCount}`);
        }
    }

    if (mismatches.length > 0) {
        throw new Error(`Verifikasi row count gagal:\n${mismatches.join("\n")}`);
    }

    console.log(`Verifikasi selesai. ${allTables.size} tabel cocok.`);
}

async function main() {
    const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim() || requiredEnv("DATABASE_URL");
    const targetUrl = requiredEnv("TARGET_DATABASE_URL");
    const sourceSslMode = process.env.SOURCE_PGSSLMODE?.trim() || "require";
    const targetSslMode = process.env.TARGET_PGSSLMODE?.trim() || new URL(targetUrl).searchParams.get("sslmode") || "require";
    const schemaName = process.env.PG_SCHEMA?.trim() || "public";
    const resetTargetSchema = process.env.RESET_TARGET_SCHEMA === "true";
    const skipVerify = process.env.SKIP_ROW_COUNT_VERIFY === "true";

    if (normalizeDatabaseIdentity(sourceUrl) === normalizeDatabaseIdentity(targetUrl)) {
        throw new Error("Source dan target database terlihat sama. Migrasi dibatalkan.");
    }

    if (!resetTargetSchema) {
        throw new Error("RESET_TARGET_SCHEMA=true wajib diisi karena full restore akan mengganti isi target.");
    }

    const tempDir = mkdtempSync(join(tmpdir(), "sparta-full-db-"));
    const dumpFile = join(tempDir, "full-database.sql");
    const resetFile = join(tempDir, "reset-target.sql");

    try {
        console.log(`Membuat dump penuh dari schema "${schemaName}"...`);
        await run(
            pgCommand("pg_dump"),
            [
                "--no-owner",
                "--no-privileges",
                "--format=plain",
                "--schema",
                schemaName,
                "--file",
                dumpFile
            ],
            buildPgEnv({ url: sourceUrl, sslMode: sourceSslMode })
        );

        writeFileSync(
            resetFile,
            [
                "SELECT pg_advisory_xact_lock(hashtext('sparta-full-database-migration'));",
                `DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE;`,
                `CREATE SCHEMA ${quoteIdentifier(schemaName)};`
            ].join("\n"),
            "utf8"
        );

        console.log("Reset target dan restore data dalam satu transaksi...");
        await run(
            pgCommand("psql"),
            [
                "--set",
                "ON_ERROR_STOP=1",
                "--single-transaction",
                "--file",
                resetFile,
                "--file",
                dumpFile
            ],
            buildPgEnv({ url: targetUrl, sslMode: targetSslMode })
        );

        if (!skipVerify) {
            await verifyRowCounts(sourceUrl, targetUrl, sourceSslMode, targetSslMode, schemaName);
        }

        console.log("Migrasi full database selesai.");
    } finally {
        rmSync(tempDir, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error("Migrasi full database gagal:", error instanceof Error ? error.message : error);
    process.exit(1);
});
