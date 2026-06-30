import dotenv from "dotenv";

dotenv.config({ path: "../sparta-be.env" });

async function main() {
    const { pool } = await import("../db/pool");

    const result = await pool.query(`
        WITH rab_item_counts AS (
            SELECT
                r.id,
                COUNT(ri.id)::int AS item_count,
                COALESCE(SUM(ri.total_harga), 0)::numeric AS item_total
            FROM rab r
            LEFT JOIN rab_item ri ON ri.id_rab = r.id
            GROUP BY r.id
        ),
        scoped AS (
            SELECT
                r.id AS rab_id,
                r.id_toko,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.lingkup_pekerjaan,
                r.status,
                r.email_pembuat,
                r.grand_total,
                r.grand_total_final,
                ric.item_count,
                ric.item_total,
                COUNT(*) OVER (PARTITION BY t.nomor_ulok, t.lingkup_pekerjaan) AS rab_count_same_scope,
                COUNT(*) FILTER (WHERE ric.item_count > 0) OVER (PARTITION BY t.nomor_ulok, t.lingkup_pekerjaan) AS sibling_with_items_count,
                MAX(ric.item_total) FILTER (WHERE ric.item_count > 0) OVER (PARTITION BY t.nomor_ulok, t.lingkup_pekerjaan) AS max_sibling_item_total,
                ARRAY_AGG(
                    jsonb_build_object(
                        'rab_id', r.id,
                        'status', r.status,
                        'grand_total', r.grand_total,
                        'grand_total_final', r.grand_total_final,
                        'item_count', ric.item_count,
                        'item_total', ric.item_total,
                        'email_pembuat', r.email_pembuat
                    )
                ) OVER (PARTITION BY t.nomor_ulok, t.lingkup_pekerjaan) AS scope_rabs
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            JOIN rab_item_counts ric ON ric.id = r.id
        )
        SELECT *
        FROM scoped
        WHERE UPPER(TRIM(status)) = 'DISETUJUI'
          AND item_count = 0
        ORDER BY nomor_ulok, lingkup_pekerjaan, rab_id
    `);

    console.log(JSON.stringify({
        approved_empty_count: result.rows.length,
        rows: result.rows,
    }, null, 2));

    const mismatch = await pool.query(`
        SELECT
            r.id AS rab_id,
            t.nomor_ulok,
            t.nama_toko,
            t.cabang,
            t.lingkup_pekerjaan,
            r.status,
            r.grand_total,
            r.grand_total_final,
            COUNT(ri.id)::int AS item_count,
            COALESCE(SUM(ri.total_harga), 0)::numeric AS item_total,
            (COALESCE(SUM(ri.total_harga), 0)::numeric - COALESCE(NULLIF(r.grand_total, ''), '0')::numeric) AS diff
        FROM rab r
        JOIN toko t ON t.id = r.id_toko
        LEFT JOIN rab_item ri ON ri.id_rab = r.id
        WHERE UPPER(TRIM(r.status)) = 'DISETUJUI'
        GROUP BY r.id, t.nomor_ulok, t.nama_toko, t.cabang, t.lingkup_pekerjaan
        HAVING COUNT(ri.id) > 0
           AND COALESCE(SUM(ri.total_harga), 0)::numeric <> COALESCE(NULLIF(r.grand_total, ''), '0')::numeric
        ORDER BY ABS(COALESCE(SUM(ri.total_harga), 0)::numeric - COALESCE(NULLIF(r.grand_total, ''), '0')::numeric) DESC,
                 t.nomor_ulok,
                 r.id
    `);

    console.log(JSON.stringify({
        approved_item_total_mismatch_count: mismatch.rows.length,
        rows: mismatch.rows,
    }, null, 2));

    await pool.end();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
