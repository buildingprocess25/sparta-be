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
    const result = await pool.query(text, params);
    return result.rows as T[];
}

function printSection(title: string, rows: unknown[]) {
    console.log(`\n=== ${title} (${rows.length}) ===`);
    console.log(JSON.stringify(rows, null, 2));
}

async function main() {
    const toko = await query(`
        SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, kode_toko, cabang
        FROM toko
        WHERE nomor_ulok = $1
        ORDER BY
            CASE UPPER(TRIM(COALESCE(lingkup_pekerjaan, '')))
                WHEN 'SIPIL' THEN 1
                WHEN 'ME' THEN 2
                ELSE 9
            END,
            id
    `, [ULOK]);

    const spk = await query(`
        SELECT ps.id, ps.id_toko, t.lingkup_pekerjaan, ps.nomor_spk, ps.status,
               ps.waktu_mulai::text, ps.waktu_selesai::text, ps.durasi::text
        FROM pengajuan_spk ps
        JOIN toko t ON t.id = ps.id_toko
        WHERE t.nomor_ulok = $1
        ORDER BY t.id, ps.id
    `, [ULOK]);

    const gantt = await query(`
        SELECT g.id AS gantt_id, g.id_toko, t.lingkup_pekerjaan, g.status,
               COUNT(DISTINCT pgnt.id)::int AS jumlah_tanggal_pengawasan,
               COUNT(DISTINCT p.id)::int AS jumlah_item_pengawasan
        FROM gantt_chart g
        JOIN toko t ON t.id = g.id_toko
        LEFT JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
        LEFT JOIN pengawasan p ON p.id_gantt = g.id
        WHERE t.nomor_ulok = $1
        GROUP BY g.id, t.lingkup_pekerjaan
        ORDER BY t.id, g.id
    `, [ULOK]);

    const checkpointSummary = await query(`
        WITH base AS (
            SELECT
                t.id AS id_toko,
                t.lingkup_pekerjaan,
                g.id AS id_gantt,
                pgnt.id AS id_pengawasan_gantt,
                pgnt.tanggal_pengawasan,
                p.id AS id_pengawasan,
                p.kategori_pekerjaan,
                p.jenis_pekerjaan,
                p.status,
                p.created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY g.id, UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))), UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                    ORDER BY to_date(pgnt.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
                ) AS rn_latest
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
            LEFT JOIN pengawasan p ON p.id_pengawasan_gantt = pgnt.id
            WHERE t.nomor_ulok = $1
        ),
        with_opname AS (
            SELECT b.*,
                EXISTS (
                    SELECT 1
                    FROM opname_item oi
                    LEFT JOIN rab_item ri ON ri.id = oi.id_rab_item
                    LEFT JOIN instruksi_lapangan_item ili ON ili.id = oi.id_instruksi_lapangan_item
                    WHERE oi.id_toko = b.id_toko
                      AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ili.kategori_pekerjaan, ''))) = UPPER(TRIM(COALESCE(b.kategori_pekerjaan, '')))
                      AND UPPER(TRIM(COALESCE(ri.jenis_pekerjaan, ili.jenis_pekerjaan, ''))) = UPPER(TRIM(COALESCE(b.jenis_pekerjaan, '')))
                ) AS has_opname
            FROM base b
        )
        SELECT lingkup_pekerjaan, id_gantt, id_pengawasan_gantt, tanggal_pengawasan,
               COUNT(id_pengawasan)::int AS total_pengawasan_items,
               COUNT(id_pengawasan) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'selesai')::int AS selesai_items,
               COUNT(id_pengawasan) FILTER (WHERE id_pengawasan IS NOT NULL AND LOWER(TRIM(COALESCE(status, ''))) <> 'selesai')::int AS belum_selesai_di_tanggal,
               COUNT(id_pengawasan) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'selesai' AND NOT has_opname)::int AS selesai_belum_opname_di_tanggal
        FROM with_opname
        GROUP BY lingkup_pekerjaan, id_gantt, id_pengawasan_gantt, tanggal_pengawasan
        ORDER BY
            CASE UPPER(TRIM(COALESCE(lingkup_pekerjaan, ''))) WHEN 'SIPIL' THEN 1 WHEN 'ME' THEN 2 ELSE 9 END,
            to_date(tanggal_pengawasan, 'DD/MM/YYYY'),
            id_pengawasan_gantt
    `, [ULOK]);

    const latestUnfinishedPengawasan = await query(`
        WITH ranked AS (
            SELECT
                t.lingkup_pekerjaan,
                g.id AS id_gantt,
                p.id,
                pgnt.tanggal_pengawasan,
                p.kategori_pekerjaan,
                p.jenis_pekerjaan,
                p.status,
                p.catatan,
                p.dokumentasi,
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
        SELECT lingkup_pekerjaan, id_gantt, id, tanggal_pengawasan, kategori_pekerjaan,
               jenis_pekerjaan, status, catatan,
               CASE WHEN NULLIF(TRIM(COALESCE(dokumentasi, '')), '') IS NULL THEN false ELSE true END AS ada_dokumentasi
        FROM ranked
        WHERE rn = 1
          AND LOWER(TRIM(COALESCE(status, ''))) <> 'selesai'
        ORDER BY
            CASE UPPER(TRIM(COALESCE(lingkup_pekerjaan, ''))) WHEN 'SIPIL' THEN 1 WHEN 'ME' THEN 2 ELSE 9 END,
            kategori_pekerjaan,
            jenis_pekerjaan
    `, [ULOK]);

    const selesaiBelumOpname = await query(`
        WITH latest_selesai AS (
            SELECT
                t.id AS id_toko,
                t.lingkup_pekerjaan,
                g.id AS id_gantt,
                p.id,
                pgnt.tanggal_pengawasan,
                p.kategori_pekerjaan,
                p.jenis_pekerjaan,
                p.status,
                p.catatan,
                p.dokumentasi,
                ROW_NUMBER() OVER (
                    PARTITION BY g.id, UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))), UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                    ORDER BY to_date(pgnt.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST, p.id DESC
                ) AS rn
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            JOIN pengawasan_gantt pgnt ON pgnt.id_gantt = g.id
            JOIN pengawasan p ON p.id_pengawasan_gantt = pgnt.id
            WHERE t.nomor_ulok = $1
              AND LOWER(TRIM(COALESCE(p.status, ''))) = 'selesai'
        )
        SELECT ls.lingkup_pekerjaan, ls.id_gantt, ls.id, ls.tanggal_pengawasan,
               ls.kategori_pekerjaan, ls.jenis_pekerjaan, ls.status, ls.catatan,
               CASE WHEN NULLIF(TRIM(COALESCE(ls.dokumentasi, '')), '') IS NULL THEN false ELSE true END AS ada_dokumentasi
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
        ORDER BY
            CASE UPPER(TRIM(COALESCE(lingkup_pekerjaan, ''))) WHEN 'SIPIL' THEN 1 WHEN 'ME' THEN 2 ELSE 9 END,
            to_date(tanggal_pengawasan, 'DD/MM/YYYY'),
            kategori_pekerjaan,
            jenis_pekerjaan
    `, [ULOK]);

    const opnameFinal = await query(`
        SELECT ofn.id AS opname_final_id, ofn.id_toko, t.lingkup_pekerjaan, ofn.tipe_opname,
               ofn.status_opname_final, ofn.aksi, ofn.created_at::text,
               COUNT(oi.id)::int AS item_count
        FROM opname_final ofn
        JOIN toko t ON t.id = ofn.id_toko
        LEFT JOIN opname_item oi ON oi.id_opname_final = ofn.id
        WHERE t.nomor_ulok = $1
        GROUP BY ofn.id, t.lingkup_pekerjaan
        ORDER BY t.id, ofn.id
    `, [ULOK]);

    const opnameItems = await query(`
        SELECT t.lingkup_pekerjaan, ofn.id AS opname_final_id, oi.id AS opname_item_id,
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
        ORDER BY
            CASE UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) WHEN 'SIPIL' THEN 1 WHEN 'ME' THEN 2 ELSE 9 END,
            kategori_pekerjaan,
            jenis_pekerjaan,
            oi.id
    `, [ULOK]);

    const st = await query(`
        SELECT bst.id, bst.id_toko, t.lingkup_pekerjaan, bst.created_at::text,
               CASE WHEN NULLIF(TRIM(COALESCE(bst.link_pdf, '')), '') IS NULL THEN false ELSE true END AS ada_pdf
        FROM berkas_serah_terima bst
        JOIN toko t ON t.id = bst.id_toko
        WHERE t.nomor_ulok = $1
        ORDER BY t.id, bst.id
    `, [ULOK]);

    printSection("TOKO", toko);
    printSection("SPK", spk);
    printSection("GANTT", gantt);
    printSection("CHECKPOINT_SUMMARY", checkpointSummary);
    printSection("PENGAWASAN_LATEST_BELUM_SELESAI", latestUnfinishedPengawasan);
    printSection("PENGAWASAN_SELESAI_BELUM_OPNAME", selesaiBelumOpname);
    printSection("OPNAME_FINAL", opnameFinal);
    printSection("OPNAME_ITEMS", opnameItems);
    printSection("SERAH_TERIMA", st);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
