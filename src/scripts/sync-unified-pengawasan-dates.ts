import fs from "fs/promises";
import path from "path";
import { pool } from "../db/pool";

type CsvValue = string | number | boolean | null | undefined | Date | Record<string, unknown> | unknown[];

const args = new Set(process.argv.slice(2));
const shouldCommit = args.has("--commit");

const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot = path.resolve(
    process.cwd(),
    "sql",
    "backups",
    `${timestamp}-unified-pengawasan-dates`
);

const csvEscape = (value: CsvValue): string => {
    if (value === null || typeof value === "undefined") return "";
    const raw = value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

const writeCsv = async (filename: string, rows: Record<string, CsvValue>[]) => {
    await fs.mkdir(backupRoot, { recursive: true });
    const filePath = path.join(backupRoot, filename);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : ["empty"];
    const body = [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n");
    await fs.writeFile(filePath, `${body}\n`, "utf8");
    return filePath;
};

const pairedScopeSql = `
    WITH latest_gantt AS (
        SELECT DISTINCT ON (g.id_toko) g.id, g.id_toko
        FROM gantt_chart g
        ORDER BY g.id_toko, g.id DESC
    ),
    scope AS (
        SELECT
            t.nomor_ulok,
            t.nama_toko,
            t.cabang,
            t.id AS id_toko,
            UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) AS lingkup,
            lg.id AS gantt_id
        FROM toko t
        JOIN latest_gantt lg ON lg.id_toko = t.id
        WHERE UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) IN ('SIPIL', 'ME')
    ),
    paired AS (
        SELECT nomor_ulok
        FROM scope
        GROUP BY nomor_ulok
        HAVING COUNT(*) FILTER (WHERE lingkup = 'SIPIL') > 0
           AND COUNT(*) FILTER (WHERE lingkup = 'ME') > 0
    )
    SELECT s.*
    FROM scope s
    JOIN paired p ON p.nomor_ulok = s.nomor_ulok
`;

const main = async () => {
    const client = await pool.connect();
    try {
        const summaryResult = await client.query(`
            WITH scope AS (${pairedScopeSql}),
            dates AS (
                SELECT
                    s.nomor_ulok,
                    s.lingkup,
                    MAX(s.id_toko) AS id_toko,
                    MAX(s.gantt_id) AS gantt_id,
                    COALESCE(
                        array_agg(DISTINCT pg.tanggal_pengawasan ORDER BY pg.tanggal_pengawasan)
                            FILTER (WHERE pg.id IS NOT NULL),
                        '{}'::text[]
                    ) AS date_list
                FROM scope s
                LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                GROUP BY s.nomor_ulok, s.lingkup
            ),
            piv AS (
                SELECT
                    nomor_ulok,
                    MAX(id_toko) FILTER (WHERE lingkup = 'SIPIL') AS sipil_id_toko,
                    MAX(id_toko) FILTER (WHERE lingkup = 'ME') AS me_id_toko,
                    MAX(gantt_id) FILTER (WHERE lingkup = 'SIPIL') AS sipil_gantt_id,
                    MAX(gantt_id) FILTER (WHERE lingkup = 'ME') AS me_gantt_id,
                    MAX(date_list) FILTER (WHERE lingkup = 'SIPIL') AS sipil_dates,
                    MAX(date_list) FILTER (WHERE lingkup = 'ME') AS me_dates
                FROM dates
                GROUP BY nomor_ulok
            ),
            diff AS (
                SELECT
                    *,
                    ARRAY(
                        SELECT d FROM unnest(sipil_dates) d
                        EXCEPT
                        SELECT d FROM unnest(me_dates) d
                        ORDER BY 1
                    ) AS sipil_only_dates,
                    ARRAY(
                        SELECT d FROM unnest(me_dates) d
                        EXCEPT
                        SELECT d FROM unnest(sipil_dates) d
                        ORDER BY 1
                    ) AS me_only_dates
                FROM piv
                WHERE COALESCE(sipil_dates, '{}'::text[]) <> COALESCE(me_dates, '{}'::text[])
            ),
            me_only_pengawasan AS (
                SELECT d.nomor_ulok, COUNT(p.id)::int AS item_count
                FROM diff d
                JOIN pengawasan_gantt pg
                  ON pg.id_gantt = d.me_gantt_id
                 AND pg.tanggal_pengawasan = ANY(d.me_only_dates)
                LEFT JOIN pengawasan p ON p.id_pengawasan_gantt = pg.id
                GROUP BY d.nomor_ulok
            )
            SELECT
                (SELECT COUNT(*) FROM piv)::int AS paired_ulok_count,
                (SELECT COUNT(*) FROM diff)::int AS different_date_ulok_count,
                (SELECT COALESCE(SUM(cardinality(sipil_only_dates)), 0)::int FROM diff) AS dates_to_insert_to_me,
                (SELECT COALESCE(SUM(cardinality(me_only_dates)), 0)::int FROM diff) AS me_dates_to_delete,
                (SELECT COUNT(*)::int FROM me_only_pengawasan WHERE item_count > 0) AS ulok_with_me_only_pengawasan_items,
                (SELECT COALESCE(SUM(item_count), 0)::int FROM me_only_pengawasan) AS me_only_pengawasan_items
        `);

        const diffRows = await client.query(`
            WITH scope AS (${pairedScopeSql}),
            dates AS (
                SELECT
                    s.nomor_ulok,
                    MAX(s.nama_toko) AS nama_toko,
                    MAX(s.cabang) AS cabang,
                    s.lingkup,
                    MAX(s.id_toko) AS id_toko,
                    MAX(s.gantt_id) AS gantt_id,
                    COALESCE(
                        array_agg(DISTINCT pg.tanggal_pengawasan ORDER BY pg.tanggal_pengawasan)
                            FILTER (WHERE pg.id IS NOT NULL),
                        '{}'::text[]
                    ) AS date_list
                FROM scope s
                LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                GROUP BY s.nomor_ulok, s.lingkup
            ),
            piv AS (
                SELECT
                    nomor_ulok,
                    MAX(nama_toko) AS nama_toko,
                    MAX(cabang) AS cabang,
                    MAX(id_toko) FILTER (WHERE lingkup = 'SIPIL') AS sipil_id_toko,
                    MAX(id_toko) FILTER (WHERE lingkup = 'ME') AS me_id_toko,
                    MAX(gantt_id) FILTER (WHERE lingkup = 'SIPIL') AS sipil_gantt_id,
                    MAX(gantt_id) FILTER (WHERE lingkup = 'ME') AS me_gantt_id,
                    MAX(date_list) FILTER (WHERE lingkup = 'SIPIL') AS sipil_dates,
                    MAX(date_list) FILTER (WHERE lingkup = 'ME') AS me_dates
                FROM dates
                GROUP BY nomor_ulok
            )
            SELECT
                *,
                ARRAY(
                    SELECT d FROM unnest(sipil_dates) d
                    EXCEPT
                    SELECT d FROM unnest(me_dates) d
                    ORDER BY 1
                ) AS sipil_only_dates,
                ARRAY(
                    SELECT d FROM unnest(me_dates) d
                    EXCEPT
                    SELECT d FROM unnest(sipil_dates) d
                    ORDER BY 1
                ) AS me_only_dates
            FROM piv
            WHERE COALESCE(sipil_dates, '{}'::text[]) <> COALESCE(me_dates, '{}'::text[])
            ORDER BY nomor_ulok
        `);

        const affectedPengawasanGantt = await client.query(`
            WITH scope AS (${pairedScopeSql}),
            sipil_dates AS (
                SELECT s.nomor_ulok, pg.tanggal_pengawasan
                FROM scope s
                JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                WHERE s.lingkup = 'SIPIL'
            ),
            me_dates AS (
                SELECT s.nomor_ulok, s.gantt_id, pg.*
                FROM scope s
                JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                WHERE s.lingkup = 'ME'
            )
            SELECT m.*
            FROM me_dates m
            WHERE NOT EXISTS (
                SELECT 1
                FROM sipil_dates sd
                WHERE sd.nomor_ulok = m.nomor_ulok
                  AND sd.tanggal_pengawasan = m.tanggal_pengawasan
            )
            ORDER BY m.nomor_ulok, m.tanggal_pengawasan
        `);

        const affectedPengawasan = await client.query(`
            WITH target_pg AS (
                WITH scope AS (${pairedScopeSql}),
                sipil_dates AS (
                    SELECT s.nomor_ulok, pg.tanggal_pengawasan
                    FROM scope s
                    JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                    WHERE s.lingkup = 'SIPIL'
                ),
                me_dates AS (
                    SELECT s.nomor_ulok, pg.*
                    FROM scope s
                    JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                    WHERE s.lingkup = 'ME'
                )
                SELECT m.id
                FROM me_dates m
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM sipil_dates sd
                    WHERE sd.nomor_ulok = m.nomor_ulok
                      AND sd.tanggal_pengawasan = m.tanggal_pengawasan
                )
            )
            SELECT p.*
            FROM pengawasan p
            JOIN target_pg t ON t.id = p.id_pengawasan_gantt
            ORDER BY p.id_pengawasan_gantt, p.id
        `);

        const affectedBerkasPengawasan = await client.query(`
            WITH target_pg AS (
                WITH scope AS (${pairedScopeSql}),
                sipil_dates AS (
                    SELECT s.nomor_ulok, pg.tanggal_pengawasan
                    FROM scope s
                    JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                    WHERE s.lingkup = 'SIPIL'
                ),
                me_dates AS (
                    SELECT s.nomor_ulok, pg.*
                    FROM scope s
                    JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                    WHERE s.lingkup = 'ME'
                )
                SELECT m.id
                FROM me_dates m
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM sipil_dates sd
                    WHERE sd.nomor_ulok = m.nomor_ulok
                      AND sd.tanggal_pengawasan = m.tanggal_pengawasan
                )
            )
            SELECT bp.*
            FROM berkas_pengawasan bp
            JOIN target_pg t ON t.id = bp.id_pengawasan_gantt
            ORDER BY bp.id_pengawasan_gantt, bp.id
        `);

        const affectedSerahTerima = await client.query(`
            WITH paired_scope AS (${pairedScopeSql})
            SELECT bst.*, t.nomor_ulok, t.lingkup_pekerjaan, t.nama_toko, t.cabang
            FROM berkas_serah_terima bst
            JOIN toko t ON t.id = bst.id_toko
            JOIN paired_scope ps ON ps.id_toko = t.id
            ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, bst.id
        `);

        const backupFiles = {
            diff: await writeCsv("pengawasan-date-diff-preview.csv", diffRows.rows),
            pengawasan_gantt: await writeCsv("affected-pengawasan-gantt.csv", affectedPengawasanGantt.rows),
            pengawasan: await writeCsv("affected-pengawasan.csv", affectedPengawasan.rows),
            berkas_pengawasan: await writeCsv("affected-berkas-pengawasan.csv", affectedBerkasPengawasan.rows),
            berkas_serah_terima: await writeCsv("paired-berkas-serah-terima.csv", affectedSerahTerima.rows),
        };

        let commitResult: Record<string, number> | null = null;

        if (shouldCommit) {
            await client.query("BEGIN");
            try {
                const inserted = await client.query(`
                    WITH scope AS (${pairedScopeSql}),
                    sipil_dates AS (
                        SELECT s.nomor_ulok, pg.tanggal_pengawasan
                        FROM scope s
                        JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
                        WHERE s.lingkup = 'SIPIL'
                    ),
                    me_scope AS (
                        SELECT nomor_ulok, gantt_id
                        FROM scope
                        WHERE lingkup = 'ME'
                    ),
                    missing AS (
                        SELECT ms.gantt_id, sd.tanggal_pengawasan
                        FROM me_scope ms
                        JOIN sipil_dates sd ON sd.nomor_ulok = ms.nomor_ulok
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM pengawasan_gantt pg
                            WHERE pg.id_gantt = ms.gantt_id
                              AND pg.tanggal_pengawasan = sd.tanggal_pengawasan
                        )
                    )
                    INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
                    SELECT gantt_id, tanggal_pengawasan
                    FROM missing
                    RETURNING id
                `);

                const deletedBerkas = await client.query(`
                    WITH target_pg AS (
                        SELECT id FROM (${affectedPengawasanGanttQuery()}) target
                    )
                    DELETE FROM berkas_pengawasan bp
                    USING target_pg t
                    WHERE bp.id_pengawasan_gantt = t.id
                    RETURNING bp.id
                `);

                const deletedPengawasan = await client.query(`
                    WITH target_pg AS (
                        SELECT id FROM (${affectedPengawasanGanttQuery()}) target
                    )
                    DELETE FROM pengawasan p
                    USING target_pg t
                    WHERE p.id_pengawasan_gantt = t.id
                    RETURNING p.id
                `);

                const deletedDates = await client.query(`
                    WITH target_pg AS (
                        SELECT id FROM (${affectedPengawasanGanttQuery()}) target
                    )
                    DELETE FROM pengawasan_gantt pg
                    USING target_pg t
                    WHERE pg.id = t.id
                    RETURNING pg.id
                `);

                await client.query("COMMIT");
                commitResult = {
                    inserted_me_dates: inserted.rowCount ?? 0,
                    deleted_berkas_pengawasan: deletedBerkas.rowCount ?? 0,
                    deleted_pengawasan: deletedPengawasan.rowCount ?? 0,
                    deleted_me_only_dates: deletedDates.rowCount ?? 0,
                };
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }

        console.log(JSON.stringify({
            mode: shouldCommit ? "commit" : "preview",
            backup_root: backupRoot,
            backup_files: backupFiles,
            summary: summaryResult.rows[0],
            commit_result: commitResult,
        }, null, 2));
    } finally {
        client.release();
        await pool.end();
    }
};

const affectedPengawasanGanttQuery = () => `
    WITH scope AS (${pairedScopeSql}),
    sipil_dates AS (
        SELECT s.nomor_ulok, pg.tanggal_pengawasan
        FROM scope s
        JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
        WHERE s.lingkup = 'SIPIL'
    ),
    me_dates AS (
        SELECT s.nomor_ulok, pg.*
        FROM scope s
        JOIN pengawasan_gantt pg ON pg.id_gantt = s.gantt_id
        WHERE s.lingkup = 'ME'
    )
    SELECT m.*
    FROM me_dates m
    WHERE NOT EXISTS (
        SELECT 1
        FROM sipil_dates sd
        WHERE sd.nomor_ulok = m.nomor_ulok
          AND sd.tanggal_pengawasan = m.tanggal_pengawasan
    )
`;

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
