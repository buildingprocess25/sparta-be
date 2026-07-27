import fs from "fs/promises";
import path from "path";
import { pool } from "../db/pool";

type RepairCase = {
    nomorUlok: string;
    targetScope: "ME";
    anchorDate: string;
    deleteEmptyPengawasanDates?: string[];
};

const CASES: RepairCase[] = [
    {
        nomorUlok: "RZ01-2604-0002",
        targetScope: "ME",
        anchorDate: "2026-05-11",
        deleteEmptyPengawasanDates: ["10/06/2028"],
    },
    {
        nomorUlok: "1SZ1-2603-0001",
        targetScope: "ME",
        anchorDate: "2026-06-17",
    },
    {
        nomorUlok: "1SZ1-1S38-0000-R",
        targetScope: "ME",
        anchorDate: "2026-05-22",
    },
];

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
        `${timestamp}-repair-selected-me-gantt-date-alignments`
    );

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SET TIME ZONE 'Asia/Jakarta'");
        await fs.mkdir(backupDir, { recursive: true });

        const affectedUloks = CASES.map((item) => item.nomorUlok);
        const before = {
            toko: await client.query(`SELECT * FROM toko WHERE nomor_ulok = ANY($1) ORDER BY nomor_ulok, id`, [affectedUloks]),
            pengajuan_spk: await client.query(
                `
                SELECT ps.*
                FROM pengajuan_spk ps
                WHERE ps.nomor_ulok = ANY($1)
                ORDER BY ps.nomor_ulok, ps.id
                `,
                [affectedUloks]
            ),
            gantt_chart: await client.query(
                `
                SELECT g.*
                FROM gantt_chart g
                JOIN toko t ON t.id = g.id_toko
                WHERE t.nomor_ulok = ANY($1)
                ORDER BY t.nomor_ulok, g.id
                `,
                [affectedUloks]
            ),
            pengawasan_gantt: await client.query(
                `
                SELECT pg.*
                FROM pengawasan_gantt pg
                JOIN gantt_chart g ON g.id = pg.id_gantt
                JOIN toko t ON t.id = g.id_toko
                WHERE t.nomor_ulok = ANY($1)
                ORDER BY t.nomor_ulok, pg.id_gantt, pg.id
                `,
                [affectedUloks]
            ),
            day_gantt_chart: await client.query(
                `
                SELECT d.*
                FROM day_gantt_chart d
                JOIN gantt_chart g ON g.id = d.id_gantt
                JOIN toko t ON t.id = g.id_toko
                WHERE t.nomor_ulok = ANY($1)
                ORDER BY t.nomor_ulok, d.id_gantt, d.id
                `,
                [affectedUloks]
            ),
        };

        await writeCsv(backupDir, "toko-before.csv", before.toko.rows);
        await writeCsv(backupDir, "pengajuan-spk-before.csv", before.pengajuan_spk.rows);
        await writeCsv(backupDir, "gantt-chart-before.csv", before.gantt_chart.rows);
        await writeCsv(backupDir, "pengawasan-gantt-before.csv", before.pengawasan_gantt.rows);
        await writeCsv(backupDir, "day-gantt-chart-before.csv", before.day_gantt_chart.rows);

        const previews: Record<string, unknown>[] = [];

        for (const repairCase of CASES) {
            const target = await client.query<{
                id_toko: number;
                gantt_id: number;
                spk_id: number;
                old_start: string;
                old_end: string;
                duration: number;
                max_day: number;
                new_start: string;
                new_end: string;
            }>(
                `
                WITH target_scope AS (
                    SELECT
                        t.id AS id_toko,
                        latest_gantt.id AS gantt_id,
                        latest_spk.id AS spk_id,
                        latest_spk.waktu_mulai::date AS old_start,
                        latest_spk.waktu_selesai::date AS old_end,
                        latest_spk.durasi::int AS duration
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
                      AND UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) = $2
                ),
                max_day AS (
                    SELECT COALESCE(MAX(NULLIF(d.h_akhir, '')::int), MAX(ts.duration), 1)::int AS max_day
                    FROM target_scope ts
                    LEFT JOIN day_gantt_chart d ON d.id_gantt = ts.gantt_id
                )
                SELECT
                    ts.*,
                    md.max_day,
                    ($3::date - (md.max_day - 1))::text AS new_start,
                    (($3::date - (md.max_day - 1)) + (ts.duration - 1))::text AS new_end
                FROM target_scope ts
                CROSS JOIN max_day md
                `,
                [repairCase.nomorUlok, repairCase.targetScope, repairCase.anchorDate]
            );

            const row = target.rows[0];
            if (!row) {
                throw new Error(`Target ${repairCase.nomorUlok} ${repairCase.targetScope} tidak lengkap`);
            }

            previews.push({
                nomor_ulok: repairCase.nomorUlok,
                scope: repairCase.targetScope,
                spk_id: row.spk_id,
                gantt_id: row.gantt_id,
                anchor_date: repairCase.anchorDate,
                old_start: row.old_start,
                old_end: row.old_end,
                duration: row.duration,
                max_day: row.max_day,
                new_start: row.new_start,
                new_end: row.new_end,
                delete_empty_pengawasan_dates: (repairCase.deleteEmptyPengawasanDates ?? []).join("; "),
            });

            if (!apply) continue;

            await client.query(
                `
                UPDATE pengajuan_spk
                SET waktu_mulai = $2::date,
                    waktu_selesai = $3::date,
                    durasi = $4
                WHERE id = $1
                `,
                [row.spk_id, row.new_start, row.new_end, row.duration]
            );

            if (repairCase.deleteEmptyPengawasanDates?.length) {
                await client.query(
                    `
                    DELETE FROM pengawasan_gantt pg
                    USING gantt_chart g, toko t
                    WHERE pg.id_gantt = g.id
                      AND g.id_toko = t.id
                      AND t.nomor_ulok = $1
                      AND pg.tanggal_pengawasan = ANY($2::text[])
                      AND NOT EXISTS (SELECT 1 FROM pengawasan p WHERE p.id_pengawasan_gantt = pg.id)
                      AND NOT EXISTS (SELECT 1 FROM berkas_pengawasan bp WHERE bp.id_pengawasan_gantt = pg.id)
                    `,
                    [repairCase.nomorUlok, repairCase.deleteEmptyPengawasanDates]
                );
            }
        }

        await writeCsv(backupDir, "repair-preview.csv", previews);
        console.table(previews);
        console.log({ apply, backup_dir: backupDir });

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
