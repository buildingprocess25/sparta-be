import fs from "fs";
import path from "path";
import { pool } from "../db/pool";

const outputPath = path.resolve(process.cwd(), "sql/reports/invalid-serah-terima-cleanup-candidates.csv");

const escapeCsv = (value: unknown) => {
    if (value === null || typeof value === "undefined") return "";
    const raw = String(value);
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

const main = async () => {
    const result = await pool.query(`
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
                          AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) =
                              UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) =
                              UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
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
                          AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) =
                              UPPER(TRIM(REPLACE(COALESCE(lp.kategori_pekerjaan, ''), '[IL] ', '')))
                          AND UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) =
                              UPPER(TRIM(COALESCE(lp.jenis_pekerjaan, '')))
                      )
                )::int AS missing_items
            FROM latest_pengawasan lp
            GROUP BY lp.id_toko
        ),
        latest_st AS (
            SELECT DISTINCT ON (id_toko)
                id,
                id_toko,
                link_pdf,
                created_at
            FROM berkas_serah_terima
            ORDER BY id_toko, id DESC
        ),
        rows AS (
            SELECT
                st.id AS berkas_serah_terima_id,
                st.id_toko,
                to_char(st.created_at, 'YYYY-MM-DD HH24:MI:SS') AS st_created_at,
                st.link_pdf,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.lingkup_pekerjaan,
                ofn.id AS opname_final_id,
                ofn.tipe_opname,
                ofn.aksi AS opname_aksi,
                ofn.status_opname_final,
                COALESCE((
                    SELECT COUNT(*)
                    FROM opname_item oi
                    WHERE oi.id_opname_final = ofn.id
                ), 0)::int AS total_opname_items,
                COALESCE(c.completed_items, 0)::int AS completed_items,
                COALESCE(c.covered_items, 0)::int AS covered_items,
                COALESCE(c.missing_items, 0)::int AS missing_items,
                EXISTS (
                    SELECT 1
                    FROM serah_terima_migration_backfill_audit aud
                    WHERE aud.id_toko = st.id_toko
                      AND aud.old_berkas_serah_terima_id = st.id
                ) AS in_migration_audit,
                (
                    SELECT aud.catatan
                    FROM serah_terima_migration_backfill_audit aud
                    WHERE aud.id_toko = st.id_toko
                      AND aud.old_berkas_serah_terima_id = st.id
                    ORDER BY aud.audit_id DESC
                    LIMIT 1
                ) AS migration_note
            FROM latest_st st
            JOIN toko t ON t.id = st.id_toko
            LEFT JOIN LATERAL (
                SELECT *
                FROM opname_final
                WHERE id_toko = t.id
                ORDER BY id DESC
                LIMIT 1
            ) ofn ON true
            LEFT JOIN completion c ON c.id_toko = t.id
            WHERE NULLIF(TRIM(COALESCE(st.link_pdf, '')), '') IS NOT NULL
        )
        SELECT *
        FROM rows
        WHERE opname_final_id IS NULL
           OR total_opname_items = 0
           OR completed_items = 0
           OR missing_items > 0
        ORDER BY in_migration_audit, cabang, nomor_ulok, lingkup_pekerjaan, berkas_serah_terima_id
    `);

    const headers = Object.keys(result.rows[0] ?? {
        berkas_serah_terima_id: "",
        id_toko: "",
        st_created_at: "",
        link_pdf: "",
        nomor_ulok: "",
        nama_toko: "",
        cabang: "",
        lingkup_pekerjaan: "",
        opname_final_id: "",
        tipe_opname: "",
        opname_aksi: "",
        status_opname_final: "",
        total_opname_items: "",
        completed_items: "",
        covered_items: "",
        missing_items: "",
        in_migration_audit: "",
        migration_note: "",
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
        outputPath,
        [headers.join(","), ...result.rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\n"),
        "utf8"
    );

    const byBucket = result.rows.reduce((acc: Record<string, number>, row: any) => {
        const key = row.in_migration_audit ? "migration_audit" : "non_migration";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});

    console.log(JSON.stringify({
        total: result.rows.length,
        by_bucket: byBucket,
        output: outputPath,
        rows: result.rows.map((row: any) => ({
            id: row.berkas_serah_terima_id,
            nomor_ulok: row.nomor_ulok,
            nama_toko: row.nama_toko,
            cabang: row.cabang,
            lingkup: row.lingkup_pekerjaan,
            st_created_at: row.st_created_at,
            opname_final_id: row.opname_final_id,
            total_opname_items: row.total_opname_items,
            completed_items: row.completed_items,
            missing_items: row.missing_items,
            in_migration_audit: row.in_migration_audit,
            migration_note: row.migration_note,
        })),
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
