import { pool } from "../db/pool";

const nomorUlok = process.argv[2];
const lingkup = process.argv[3];

const main = async () => {
    if (!nomorUlok || !lingkup) {
        throw new Error("Usage: npx tsx src/scripts/check-st-photo-source.ts <nomor_ulok> <lingkup>");
    }

    const result = await pool.query(
        `
        WITH target AS (
            SELECT id
            FROM toko
            WHERE nomor_ulok = $1
              AND UPPER(TRIM(COALESCE(lingkup_pekerjaan, ''))) = UPPER(TRIM($2))
            LIMIT 1
        )
        SELECT
            g.id AS gantt_id,
            COUNT(DISTINCT p.id)::int AS pengawasan_rows,
            COUNT(DISTINCT p.id) FILTER (
                WHERE NULLIF(TRIM(COALESCE(p.dokumentasi, '')), '') IS NOT NULL
                   OR NULLIF(TRIM(COALESCE(p.dokumentasi_base64, '')), '') IS NOT NULL
            )::int AS pengawasan_with_photo,
            COUNT(DISTINCT oi.id)::int AS opname_items,
            COUNT(DISTINCT oi.id) FILTER (
                WHERE NULLIF(TRIM(COALESCE(oi.foto, '')), '') IS NOT NULL
            )::int AS opname_items_with_photo
        FROM target t
        LEFT JOIN gantt_chart g ON g.id_toko = t.id
        LEFT JOIN pengawasan p ON p.id_gantt = g.id
        LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
        LEFT JOIN opname_item oi ON oi.id_opname_final = ofn.id
        GROUP BY g.id
        ORDER BY g.id DESC
        `,
        [nomorUlok, lingkup]
    );

    console.log(JSON.stringify({
        nomor_ulok: nomorUlok,
        lingkup,
        rows: result.rows,
    }, null, 2));
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
