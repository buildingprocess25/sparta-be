import { pool } from "../db/pool";

const main = async () => {
    const countSql = `
        WITH latest_gantt AS (
            SELECT DISTINCT ON (id_toko) id, id_toko
            FROM gantt_chart
            ORDER BY id_toko, id DESC
        ),
        latest_pengawasan AS (
            SELECT DISTINCT ON (
                g.id_toko,
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
            )
                g.id_toko,
                p.kategori_pekerjaan,
                p.jenis_pekerjaan,
                p.status
            FROM pengawasan p
            LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            JOIN latest_gantt g ON g.id = p.id_gantt
            ORDER BY
                g.id_toko,
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                p.id DESC
        ),
        completion AS (
            SELECT
                lp.id_toko,
                COUNT(*) FILTER (WHERE lp.status = 'selesai')::int AS completed_items,
                COUNT(*) FILTER (
                    WHERE lp.status = 'selesai'
                      AND EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = lp.id_toko
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
                      )
                )::int AS covered_items,
                COUNT(*) FILTER (
                    WHERE lp.status = 'selesai'
                      AND NOT EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = lp.id_toko
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
                      )
                )::int AS missing_items
            FROM latest_pengawasan lp
            GROUP BY lp.id_toko
        ),
        st AS (
            SELECT
                bst.id,
                bst.id_toko,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.lingkup_pekerjaan,
                ofn.id AS opname_final_id,
                COALESCE((
                    SELECT COUNT(*)
                    FROM opname_item oi
                    WHERE oi.id_opname_final = ofn.id
                ), 0)::int AS total_opname_items,
                COALESCE(c.completed_items, 0)::int AS completed_items,
                COALESCE(c.covered_items, 0)::int AS covered_items,
                COALESCE(c.missing_items, 0)::int AS missing_items
            FROM berkas_serah_terima bst
            JOIN toko t ON t.id = bst.id_toko
            LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
            LEFT JOIN completion c ON c.id_toko = t.id
            WHERE bst.link_pdf IS NOT NULL
        )
        SELECT
            COUNT(*)::int AS invalid_st_count,
            COUNT(*) FILTER (WHERE UPPER(COALESCE(cabang, '')) = 'LUWU')::int AS invalid_luwu_count
        FROM st
        WHERE opname_final_id IS NULL
           OR total_opname_items = 0
           OR completed_items = 0
           OR missing_items > 0
    `;

    const sampleSql = `
        WITH latest_gantt AS (
            SELECT DISTINCT ON (id_toko) id, id_toko
            FROM gantt_chart
            ORDER BY id_toko, id DESC
        ),
        latest_pengawasan AS (
            SELECT DISTINCT ON (
                g.id_toko,
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
            )
                g.id_toko,
                p.kategori_pekerjaan,
                p.jenis_pekerjaan,
                p.status
            FROM pengawasan p
            LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            JOIN latest_gantt g ON g.id = p.id_gantt
            ORDER BY
                g.id_toko,
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                p.id DESC
        ),
        completion AS (
            SELECT
                lp.id_toko,
                COUNT(*) FILTER (WHERE lp.status = 'selesai')::int AS completed_items,
                COUNT(*) FILTER (
                    WHERE lp.status = 'selesai'
                      AND EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = lp.id_toko
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
                      )
                )::int AS covered_items,
                COUNT(*) FILTER (
                    WHERE lp.status = 'selesai'
                      AND NOT EXISTS (
                        SELECT 1
                        FROM opname_item oi
                        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                        WHERE oi.id_toko = lp.id_toko
                          AND UPPER(TRIM(COALESCE(
                                ri.kategori_pekerjaan,
                                ili.kategori_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(
                                ri.jenis_pekerjaan,
                                ili.jenis_pekerjaan,
                                ''
                          ))) = UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
                      )
                )::int AS missing_items
            FROM latest_pengawasan lp
            GROUP BY lp.id_toko
        ),
        st AS (
            SELECT
                bst.id,
                bst.id_toko,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.lingkup_pekerjaan,
                ofn.id AS opname_final_id,
                COALESCE((
                    SELECT COUNT(*)
                    FROM opname_item oi
                    WHERE oi.id_opname_final = ofn.id
                ), 0)::int AS total_opname_items,
                COALESCE(c.completed_items, 0)::int AS completed_items,
                COALESCE(c.covered_items, 0)::int AS covered_items,
                COALESCE(c.missing_items, 0)::int AS missing_items
            FROM berkas_serah_terima bst
            JOIN toko t ON t.id = bst.id_toko
            LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
            LEFT JOIN completion c ON c.id_toko = t.id
            WHERE bst.link_pdf IS NOT NULL
        )
        SELECT *
        FROM st
        WHERE opname_final_id IS NULL
           OR total_opname_items = 0
           OR completed_items = 0
           OR missing_items > 0
        ORDER BY nomor_ulok, lingkup_pekerjaan
        LIMIT 10
    `;

    const count = await pool.query(countSql);
    const sample = await pool.query(sampleSql);
    console.log(JSON.stringify({ count: count.rows[0], sample: sample.rows }, null, 2));
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
