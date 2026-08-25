import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ULOK = "2AZ1-2605-0005";

function readDatabaseUrl(): string {
    const envPath = path.resolve(__dirname, "../../../sparta-be.env");
    const raw = fs.readFileSync(envPath, "utf8");
    const line = raw.split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
    if (!line) throw new Error(`DATABASE_URL tidak ditemukan di ${envPath}`);
    return line.slice("DATABASE_URL=".length).trim();
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || readDatabaseUrl() });

async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
    return (await pool.query(text, params)).rows as T[];
}

function csv(rows: Record<string, unknown>[]) {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => {
        const text = value == null ? "" : String(value);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

async function main() {
    const outDir = path.resolve(__dirname, "../../../outputs/audit-2az1-2605-0005");
    fs.mkdirSync(outDir, { recursive: true });

    const dateDiff = await query(`
        WITH d AS (
            SELECT t.lingkup_pekerjaan, pgnt.tanggal_pengawasan
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
            WHERE t.nomor_ulok = $1
        ),
        sipil AS (SELECT tanggal_pengawasan FROM d WHERE UPPER(TRIM(lingkup_pekerjaan)) = 'SIPIL'),
        me AS (SELECT tanggal_pengawasan FROM d WHERE UPPER(TRIM(lingkup_pekerjaan)) = 'ME')
        SELECT 'SIPIL_ONLY' AS posisi, s.tanggal_pengawasan
        FROM sipil s
        WHERE NOT EXISTS (SELECT 1 FROM me WHERE me.tanggal_pengawasan = s.tanggal_pengawasan)
        UNION ALL
        SELECT 'ME_ONLY' AS posisi, me.tanggal_pengawasan
        FROM me
        WHERE NOT EXISTS (SELECT 1 FROM sipil s WHERE s.tanggal_pengawasan = me.tanggal_pengawasan)
        ORDER BY posisi, to_date(tanggal_pengawasan, 'DD/MM/YYYY')
    `, [ULOK]);

    const unfinished = await query(`
        WITH ranked AS (
            SELECT t.lingkup_pekerjaan, g.id AS id_gantt, p.id AS id_pengawasan,
                   pgnt.tanggal_pengawasan, p.kategori_pekerjaan, p.jenis_pekerjaan,
                   p.status, p.catatan,
                   CASE WHEN NULLIF(TRIM(COALESCE(p.dokumentasi, '')), '') IS NULL THEN false ELSE true END AS ada_dokumentasi,
                   ROW_NUMBER() OVER (
                       PARTITION BY g.id, UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))), UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                       ORDER BY to_date(pgnt.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
                   ) AS rn
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
            JOIN pengawasan p ON p.id_pengawasan_gantt = pgnt.id
            WHERE t.nomor_ulok = $1
        )
        SELECT lingkup_pekerjaan, id_gantt, id_pengawasan, tanggal_pengawasan,
               kategori_pekerjaan, jenis_pekerjaan, status, ada_dokumentasi, catatan
        FROM ranked
        WHERE rn = 1 AND LOWER(TRIM(COALESCE(status, ''))) <> 'selesai'
        ORDER BY lingkup_pekerjaan DESC, kategori_pekerjaan, jenis_pekerjaan
    `, [ULOK]);

    const doneNoOpname = await query(`
        WITH latest_selesai AS (
            SELECT t.id AS id_toko, t.lingkup_pekerjaan, g.id AS id_gantt, p.id AS id_pengawasan,
                   pgnt.tanggal_pengawasan, p.kategori_pekerjaan, p.jenis_pekerjaan,
                   p.status, p.catatan,
                   CASE WHEN NULLIF(TRIM(COALESCE(p.dokumentasi, '')), '') IS NULL THEN false ELSE true END AS ada_dokumentasi,
                   ROW_NUMBER() OVER (
                       PARTITION BY g.id, UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))), UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                       ORDER BY to_date(pgnt.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
                   ) AS rn
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
            JOIN pengawasan p ON p.id_pengawasan_gantt = pgnt.id
            WHERE t.nomor_ulok = $1 AND LOWER(TRIM(COALESCE(p.status, ''))) = 'selesai'
        )
        SELECT ls.lingkup_pekerjaan, ls.id_gantt, ls.id_pengawasan, ls.tanggal_pengawasan,
               ls.kategori_pekerjaan, ls.jenis_pekerjaan, ls.status, ls.ada_dokumentasi, ls.catatan
        FROM latest_selesai ls
        WHERE ls.rn = 1
          AND NOT EXISTS (
              SELECT 1
              FROM opname_item oi
              LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
              LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
              WHERE oi.id_toko = ls.id_toko
                AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ls.kategori_pekerjaan, '')))
                AND UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(ls.jenis_pekerjaan, '')))
          )
        ORDER BY lingkup_pekerjaan DESC, tanggal_pengawasan, kategori_pekerjaan, jenis_pekerjaan
    `, [ULOK]);

    const opname = await query(`
        SELECT t.lingkup_pekerjaan, ofn.id AS opname_final_id, ofn.status_opname_final,
               oi.id AS opname_item_id,
               COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan) AS kategori_pekerjaan,
               COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan) AS jenis_pekerjaan,
               oi.status, oi.volume_akhir, oi.selisih_volume, oi.total_selisih,
               oi.desain, oi.kualitas, oi.spesifikasi,
               CASE WHEN NULLIF(TRIM(COALESCE(oi.foto, '')), '') IS NULL THEN false ELSE true END AS ada_foto,
               oi.catatan
        FROM opname_item oi
        JOIN toko t ON t.id = oi.id_toko
        LEFT JOIN opname_final ofn ON ofn.id = oi.id_opname_final
        LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
        LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
        WHERE t.nomor_ulok = $1
        ORDER BY lingkup_pekerjaan DESC, kategori_pekerjaan, jenis_pekerjaan, oi.id
    `, [ULOK]);

    fs.writeFileSync(path.join(outDir, "tanggal-mismatch.csv"), csv(dateDiff));
    fs.writeFileSync(path.join(outDir, "pengawasan-latest-belum-selesai.csv"), csv(unfinished));
    fs.writeFileSync(path.join(outDir, "pengawasan-selesai-belum-opname.csv"), csv(doneNoOpname));
    fs.writeFileSync(path.join(outDir, "opname-items.csv"), csv(opname));

    console.log(JSON.stringify({
        outDir,
        tanggalMismatch: dateDiff.length,
        pengawasanLatestBelumSelesai: unfinished.length,
        pengawasanSelesaiBelumOpname: doneNoOpname.length,
        opnameItems: opname.length,
        files: [
            "tanggal-mismatch.csv",
            "pengawasan-latest-belum-selesai.csv",
            "pengawasan-selesai-belum-opname.csv",
            "opname-items.csv",
        ],
    }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
