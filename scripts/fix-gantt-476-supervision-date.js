require("dotenv").config();

const { Client } = require("pg");

const base = process.env.DATABASE_URL;
const sep = base.includes("?") ? "&" : "?";
const client = new Client({
    connectionString: `${base}${sep}uselibpqcompat=true&sslmode=require`,
    connectionTimeoutMillis: 60000,
    ssl: { rejectUnauthorized: false },
});

(async () => {
    await client.connect();
    const result = await client.query(
        `
        INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
        SELECT $1, $2::varchar
        WHERE NOT EXISTS (
            SELECT 1
            FROM pengawasan_gantt
            WHERE id_gantt = $1
              AND tanggal_pengawasan = $2::varchar
        )
        RETURNING id, id_gantt, tanggal_pengawasan
        `,
        [476, "18/06/2026"]
    );

    const verified = await client.query(
        `
        SELECT id, id_gantt, tanggal_pengawasan
        FROM pengawasan_gantt
        WHERE id_gantt = $1
          AND tanggal_pengawasan = $2::varchar
        `,
        [476, "18/06/2026"]
    );

    console.log(JSON.stringify({
        inserted: result.rows,
        verified: verified.rows,
    }, null, 2));
})()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await client.end().catch(() => {});
    });
