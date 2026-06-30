import dotenv from "dotenv";

dotenv.config({ path: "../sparta-be.env" });

async function main() {
    const { pool } = await import("../db/pool");

    const result = await pool.query(`
        WITH multi_scope AS (
            SELECT nomor_ulok
            FROM toko
            WHERE nomor_ulok IS NOT NULL
            GROUP BY nomor_ulok
            HAVING COUNT(DISTINCT UPPER(TRIM(COALESCE(lingkup_pekerjaan, '')))) > 1
        )
        SELECT
            t.nomor_ulok,
            t.nama_toko,
            COUNT(DISTINCT t.id) AS toko_scope_count,
            COUNT(DISTINCT ps.id) AS spk_count,
            COUNT(DISTINCT ps.id_toko) FILTER (WHERE ps.id_toko IS NOT NULL) AS spk_explicit_toko_count,
            jsonb_agg(DISTINCT jsonb_build_object(
                'id_toko', t.id,
                'lingkup_toko', t.lingkup_pekerjaan
            )) AS toko_scopes,
            jsonb_agg(DISTINCT jsonb_build_object(
                'spk_id', ps.id,
                'spk_id_toko', ps.id_toko,
                'lingkup_spk', ps.lingkup_pekerjaan,
                'grand_total', ps.grand_total,
                'status', ps.status
            )) FILTER (WHERE ps.id IS NOT NULL) AS spks
        FROM toko t
        JOIN multi_scope ms ON ms.nomor_ulok = t.nomor_ulok
        LEFT JOIN pengajuan_spk ps ON ps.nomor_ulok = t.nomor_ulok
        GROUP BY t.nomor_ulok, t.nama_toko
        HAVING COUNT(DISTINCT ps.id) > 0
        ORDER BY COUNT(DISTINCT ps.id) DESC, t.nomor_ulok
    `);

    const risky = result.rows.filter((row: any) => {
        const scopes = Array.isArray(row.toko_scopes) ? row.toko_scopes.length : Number(row.toko_scope_count || 0);
        const explicit = Number(row.spk_explicit_toko_count || 0);
        return scopes > 1 && Number(row.spk_count || 0) > 0 && explicit > 0;
    });

    console.log(JSON.stringify({
        multi_scope_with_spk_count: result.rows.length,
        likely_affected_by_old_dashboard_spread_count: risky.length,
        rows: result.rows,
    }, null, 2));

    await pool.end();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
