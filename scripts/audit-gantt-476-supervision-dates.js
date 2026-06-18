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
        SELECT
            gc.id AS gantt_id,
            t.id AS toko_id,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            pg.id AS pengawasan_gantt_id,
            pg.tanggal_pengawasan
        FROM gantt_chart gc
        JOIN toko t ON t.id = gc.id_toko
        LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = gc.id
        WHERE t.nomor_ulok = (
            SELECT t2.nomor_ulok
            FROM gantt_chart gc2
            JOIN toko t2 ON t2.id = gc2.id_toko
            WHERE gc2.id = $1
        )
        ORDER BY gc.id, pg.id
        `,
        [476]
    );
    console.log(JSON.stringify(result.rows, null, 2));
})()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await client.end().catch(() => {});
    });
