import fs from "fs/promises";
import path from "path";
import { pool } from "../db/pool";

const TARGET_ULOK = "WZ01-2603-0002";

const quoteCsv = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const writeCsv = async (dir: string, filename: string, rows: Record<string, unknown>[]) => {
    const headers = Array.from(rows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
    }, new Set<string>()));
    const content = [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => quoteCsv(row[header])).join(",")),
    ].join("\n");
    await fs.writeFile(path.join(dir, filename), content, "utf8");
};

const main = async () => {
    const apply = process.argv.includes("--apply");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.resolve(
        process.cwd(),
        "sql",
        "backups",
        `${timestamp}-repair-wz01-2603-0002-me-gantt-dates`
    );

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SET TIME ZONE 'Asia/Jakarta'");

        const context = await client.query<{
            sipil_toko_id: number;
            me_toko_id: number;
            sipil_gantt_id: number;
            me_gantt_id: number;
            sipil_spk_id: number;
            me_spk_id: number;
            sipil_start: string;
            sipil_end: string;
            me_duration: number;
            new_me_start: string;
            new_me_end: string;
        }>(
            `
            WITH scoped AS (
                SELECT
                    t.id AS toko_id,
                    UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) AS scope_name,
                    latest_gantt.id AS gantt_id,
                    latest_spk.id AS spk_id,
                    latest_spk.waktu_mulai::date AS spk_start,
                    latest_spk.waktu_selesai::date AS spk_end,
                    latest_spk.durasi::int AS spk_duration
                FROM toko t
                LEFT JOIN LATERAL (
                    SELECT g.id
                    FROM gantt_chart g
                    WHERE g.id_toko = t.id
                    ORDER BY g.id DESC
                    LIMIT 1
                ) latest_gantt ON true
                LEFT JOIN LATERAL (
                    SELECT ps.id, ps.waktu_mulai, ps.waktu_selesai, ps.durasi
                    FROM pengajuan_spk ps
                    WHERE ps.id_toko = t.id
                      AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
                    ORDER BY ps.id DESC
                    LIMIT 1
                ) latest_spk ON true
                WHERE t.nomor_ulok = $1
            ),
            pair AS (
                SELECT
                    sipil.toko_id AS sipil_toko_id,
                    me.toko_id AS me_toko_id,
                    sipil.gantt_id AS sipil_gantt_id,
                    me.gantt_id AS me_gantt_id,
                    sipil.spk_id AS sipil_spk_id,
                    me.spk_id AS me_spk_id,
                    sipil.spk_start AS sipil_start,
                    sipil.spk_end AS sipil_end,
                    COALESCE(me.spk_duration, 20) AS me_duration
                FROM scoped sipil
                JOIN scoped me ON me.scope_name = 'ME'
                WHERE sipil.scope_name = 'SIPIL'
            )
            SELECT
                *,
                (sipil_end - (me_duration - 1))::text AS new_me_start,
                sipil_end::text AS new_me_end
            FROM pair
            `,
            [TARGET_ULOK]
        );

        const target = context.rows[0];
        if (!target) {
            throw new Error(`Data SIPIL/ME/SPK/Gantt tidak lengkap untuk ${TARGET_ULOK}`);
        }

        const backupRows = {
            toko: await client.query(`SELECT * FROM toko WHERE id IN ($1, $2) ORDER BY id`, [target.sipil_toko_id, target.me_toko_id]),
            pengajuan_spk: await client.query(`SELECT * FROM pengajuan_spk WHERE id IN ($1, $2) ORDER BY id`, [target.sipil_spk_id, target.me_spk_id]),
            pengawasan_gantt: await client.query(`SELECT * FROM pengawasan_gantt WHERE id_gantt IN ($1, $2) ORDER BY id_gantt, id`, [target.sipil_gantt_id, target.me_gantt_id]),
            day_gantt_chart: await client.query(
                `
                SELECT d.*
                FROM day_gantt_chart d
                WHERE d.id_gantt IN ($1, $2)
                ORDER BY d.id_gantt, d.id
                `,
                [target.sipil_gantt_id, target.me_gantt_id]
            ),
        };

        await fs.mkdir(backupDir, { recursive: true });
        await writeCsv(backupDir, "toko-before.csv", backupRows.toko.rows);
        await writeCsv(backupDir, "pengajuan-spk-before.csv", backupRows.pengajuan_spk.rows);
        await writeCsv(backupDir, "pengawasan-gantt-before.csv", backupRows.pengawasan_gantt.rows);
        await writeCsv(backupDir, "day-gantt-chart-before.csv", backupRows.day_gantt_chart.rows);

        const sipilDates = await client.query<{ tanggal_pengawasan: string }>(
            `
            SELECT tanggal_pengawasan
            FROM (
                SELECT DISTINCT pg.tanggal_pengawasan
                FROM pengawasan_gantt pg
                WHERE pg.id_gantt = $1
            ) dates
            ORDER BY to_date(tanggal_pengawasan, 'DD/MM/YYYY')
            `,
            [target.sipil_gantt_id]
        );

        console.log({
            target_ulok: TARGET_ULOK,
            apply,
            backup_dir: backupDir,
            me_spk_id: target.me_spk_id,
            me_gantt_id: target.me_gantt_id,
            old_me_window: backupRows.pengajuan_spk.rows.find((row: any) => Number(row.id) === Number(target.me_spk_id)),
            new_me_start: target.new_me_start,
            new_me_end: target.new_me_end,
            copied_pengawasan_dates: sipilDates.rows.map((row) => row.tanggal_pengawasan),
        });

        if (apply) {
            await client.query(
                `
                UPDATE pengajuan_spk
                SET waktu_mulai = $2::date,
                    waktu_selesai = $3::date,
                    durasi = $4
                WHERE id = $1
                `,
                [target.me_spk_id, target.new_me_start, target.new_me_end, target.me_duration]
            );

            await client.query(
                `
                DELETE FROM pengawasan_gantt pg
                WHERE pg.id_gantt = $1
                  AND NOT EXISTS (SELECT 1 FROM pengawasan p WHERE p.id_pengawasan_gantt = pg.id)
                  AND NOT EXISTS (SELECT 1 FROM berkas_pengawasan bp WHERE bp.id_pengawasan_gantt = pg.id)
                `,
                [target.me_gantt_id]
            );

            for (const row of sipilDates.rows) {
                await client.query(
                    `
                    INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
                    SELECT $1, $2::text
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM pengawasan_gantt
                        WHERE id_gantt = $1
                          AND tanggal_pengawasan = $2::text
                    )
                    `,
                    [target.me_gantt_id, row.tanggal_pengawasan]
                );
            }
        }

        const afterRows = {
            pengajuan_spk: await client.query(`SELECT * FROM pengajuan_spk WHERE id IN ($1, $2) ORDER BY id`, [target.sipil_spk_id, target.me_spk_id]),
            pengawasan_gantt: await client.query(`SELECT * FROM pengawasan_gantt WHERE id_gantt IN ($1, $2) ORDER BY id_gantt, id`, [target.sipil_gantt_id, target.me_gantt_id]),
        };
        await writeCsv(backupDir, "pengajuan-spk-after-preview.csv", afterRows.pengajuan_spk.rows);
        await writeCsv(backupDir, "pengawasan-gantt-after-preview.csv", afterRows.pengawasan_gantt.rows);

        if (apply) {
            await client.query("COMMIT");
            console.log("Repair committed.");
        } else {
            await client.query("ROLLBACK");
            console.log("Dry-run selesai. Jalankan lagi dengan --apply untuk commit.");
        }
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
