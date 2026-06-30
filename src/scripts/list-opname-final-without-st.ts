import fs from "fs";
import path from "path";
import { pool } from "../db/pool";

const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith("--out="));
const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg.slice("--out=".length))
    : path.resolve(process.cwd(), "sql/reports/opname-final-without-st.csv");

type Row = {
    cabang: string | null;
    nomor_ulok: string | null;
    nama_toko: string | null;
    lingkup_pekerjaan: string | null;
    id_toko: number;
    opname_final_id: number;
    tipe_opname: string | null;
    aksi: string | null;
    status_opname_final: string | null;
    tanggal_opname_final: string | null;
    link_pdf_opname: string | null;
    opname_item_count: number;
    berkas_serah_terima_id: number | null;
    link_pdf_serah_terima: string | null;
};

const escapeCsv = (value: unknown) => {
    if (value === null || typeof value === "undefined") return "";
    const raw = String(value);
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

const main = async () => {
    const result = await pool.query<Row>(`
        WITH latest_opname AS (
            SELECT DISTINCT ON (id_toko)
                id,
                id_toko,
                tipe_opname,
                aksi,
                status_opname_final,
                created_at,
                link_pdf_opname
            FROM opname_final
            ORDER BY id_toko, id DESC
        ),
        latest_st AS (
            SELECT DISTINCT ON (id_toko)
                id,
                id_toko,
                link_pdf
            FROM berkas_serah_terima
            ORDER BY id_toko, id DESC
        )
        SELECT
            t.cabang,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            t.id AS id_toko,
            ofn.id AS opname_final_id,
            ofn.tipe_opname,
            ofn.aksi,
            ofn.status_opname_final,
            to_char(ofn.created_at, 'YYYY-MM-DD') AS tanggal_opname_final,
            ofn.link_pdf_opname,
            COALESCE(oi.item_count, 0)::int AS opname_item_count,
            st.id AS berkas_serah_terima_id,
            st.link_pdf AS link_pdf_serah_terima
        FROM toko t
        JOIN latest_opname ofn ON ofn.id_toko = t.id
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS item_count
            FROM opname_item oi
            WHERE oi.id_opname_final = ofn.id
        ) oi ON true
        LEFT JOIN latest_st st ON st.id_toko = t.id
        WHERE NULLIF(TRIM(COALESCE(st.link_pdf, '')), '') IS NULL
        ORDER BY
            t.cabang NULLS LAST,
            t.nomor_ulok NULLS LAST,
            t.lingkup_pekerjaan NULLS LAST,
            t.id
    `);

    const rows = result.rows;
    const byCabang = new Map<string, number>();
    for (const row of rows) {
        const cabang = row.cabang ?? "(tanpa cabang)";
        byCabang.set(cabang, (byCabang.get(cabang) ?? 0) + 1);
    }

    const headers = [
        "cabang",
        "nomor_ulok",
        "nama_toko",
        "lingkup_pekerjaan",
        "id_toko",
        "opname_final_id",
        "tipe_opname",
        "aksi",
        "status_opname_final",
        "tanggal_opname_final",
        "opname_item_count",
        "berkas_serah_terima_id",
        "link_pdf_opname",
        "link_pdf_serah_terima",
    ];

    const csv = [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => escapeCsv(row[header as keyof Row])).join(",")),
    ].join("\n");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, csv, "utf8");

    console.log(JSON.stringify({
        total: rows.length,
        output: outputPath,
        by_cabang: Array.from(byCabang.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([cabang, count]) => ({ cabang, count })),
        sample: rows.slice(0, 20),
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
