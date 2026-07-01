import fs from "fs/promises";
import path from "path";
import { pool } from "../db/pool";
import { GoogleProvider } from "../common/google";
import { serahTerimaService } from "../modules/serah-terima/serah-terima.service";

type CsvValue = string | number | boolean | null | undefined | Date | Record<string, unknown> | unknown[];

const args = process.argv.slice(2);
const shouldCommit = args.includes("--commit");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const offsetArg = args.find((arg) => arg.startsWith("--offset="));
const offset = offsetArg ? Number(offsetArg.split("=")[1]) : 0;

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.resolve(
    process.cwd(),
    "sql",
    "backups",
    `${timestamp}-unified-serah-terima`
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

const candidateSql = `
    WITH st AS (
        SELECT
            t.nomor_ulok,
            MAX(t.nama_toko) AS nama_toko,
            MAX(t.cabang) AS cabang,
            COUNT(bst.id)::int AS st_rows,
            COUNT(bst.id) FILTER (WHERE bst.link_pdf IS NOT NULL)::int AS st_pdf_rows,
            COUNT(bst.id) FILTER (
                WHERE UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) = 'SIPIL'
                  AND bst.link_pdf IS NOT NULL
            )::int AS sipil_st_pdfs,
            COUNT(bst.id) FILTER (
                WHERE UPPER(TRIM(COALESCE(t.lingkup_pekerjaan, ''))) = 'ME'
                  AND bst.link_pdf IS NOT NULL
            )::int AS me_st_pdfs
        FROM toko t
        JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        GROUP BY t.nomor_ulok
    )
    SELECT *
    FROM st
    WHERE st_pdf_rows > 0
    ORDER BY nomor_ulok
`;

const existingRowsSql = `
    SELECT
        bst.id,
        bst.id_toko,
        bst.link_pdf,
        bst.created_at,
        t.nomor_ulok,
        t.lingkup_pekerjaan,
        t.nama_toko,
        t.cabang
    FROM berkas_serah_terima bst
    JOIN toko t ON t.id = bst.id_toko
    WHERE t.nomor_ulok = ANY($1::text[])
    ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, bst.id
`;

const main = async () => {
    if (shouldCommit) {
        await GoogleProvider.initialize();
    }

    const candidateResult = await pool.query(candidateSql);
    const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const candidates = typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? candidateResult.rows.slice(start, start + limit)
        : candidateResult.rows.slice(start);
    const nomorUloks = candidates.map((row) => row.nomor_ulok);
    const existingRows = nomorUloks.length > 0
        ? await pool.query(existingRowsSql, [nomorUloks])
        : { rows: [] as Record<string, CsvValue>[] };

    const backupFiles = {
        candidates: await writeCsv("unified-serah-terima-candidates.csv", candidates),
        berkas_serah_terima: await writeCsv("affected-berkas-serah-terima.csv", existingRows.rows),
    };

    const results: Array<Record<string, CsvValue>> = [];

    if (shouldCommit) {
        for (const candidate of candidates) {
            try {
                const result = await serahTerimaService.createPdfSerahTerimaUnified(candidate.nomor_ulok);
                results.push({
                    nomor_ulok: candidate.nomor_ulok,
                    status: "success",
                    berkas_id: result.id,
                    link_pdf: result.link_pdf,
                    item_count: result.item_count,
                    error: null,
                });
            } catch (error) {
                results.push({
                    nomor_ulok: candidate.nomor_ulok,
                    status: "failed",
                    berkas_id: null,
                    link_pdf: null,
                    item_count: null,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        backupFiles["commit_results" as keyof typeof backupFiles] = await writeCsv(
            "unified-serah-terima-commit-results.csv",
            results
        );
    }

    console.log(JSON.stringify({
        mode: shouldCommit ? "commit" : "preview",
        backup_root: backupRoot,
        backup_files: backupFiles,
        total_candidates: candidateResult.rows.length,
        selected_candidates: candidates.length,
        offset: start,
        commit_summary: shouldCommit
            ? {
                success: results.filter((row) => row.status === "success").length,
                failed: results.filter((row) => row.status === "failed").length,
            }
            : null,
    }, null, 2));

    await pool.end();
};

main().catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
});
