/**
 * Regenerate Opname Final PDFs impacted by the denda policy update.
 *
 * Preview: npx tsx src/scripts/regenerate-opname-final-denda-pdfs.ts
 * Commit : npx tsx src/scripts/regenerate-opname-final-denda-pdfs.ts --commit
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { GoogleProvider } from "../common/google";
import { pool } from "../db/pool";
import { opnameFinalService } from "../modules/opname-final/opname-final.service";

dotenv.config({ path: path.join(__dirname, "../../sparta-be.env") });

type TargetRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    nama_toko: string | null;
    cabang: string | null;
    hari_denda: number;
    nilai_denda: string;
    link_pdf_opname: string | null;
};

type RunResult = TargetRow & {
    status: "WOULD_REGENERATE" | "REGENERATED" | "FAILED";
    new_link_pdf_opname?: string | null;
    error?: string | null;
};

const getArgValue = (name: string): string | null => {
    const prefix = `${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
};

const escapeCsv = (value: unknown): string => {
    const text = String(value ?? "");
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
};

const writeReport = (rows: RunResult[]): string => {
    const dir = path.join(__dirname, "../../sql/reports");
    fs.mkdirSync(dir, { recursive: true });
    const filename = `opname-final-denda-pdf-regenerate-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    const filePath = path.join(dir, filename);
    const headers = [
        "status",
        "id",
        "id_toko",
        "nomor_ulok",
        "lingkup_pekerjaan",
        "nama_toko",
        "cabang",
        "hari_denda",
        "nilai_denda",
        "old_link_pdf_opname",
        "new_link_pdf_opname",
        "error",
    ];
    const lines = [
        headers.join(","),
        ...rows.map((row) => [
            row.status,
            row.id,
            row.id_toko,
            row.nomor_ulok,
            row.lingkup_pekerjaan,
            row.nama_toko,
            row.cabang,
            row.hari_denda,
            row.nilai_denda,
            row.link_pdf_opname,
            row.new_link_pdf_opname,
            row.error,
        ].map(escapeCsv).join(",")),
    ];
    fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
    return filePath;
};

async function main() {
    const commit = process.argv.includes("--commit");
    const limit = Math.max(1, Number(getArgValue("--limit") ?? 50));
    const offset = Math.max(0, Number(getArgValue("--offset") ?? 0));

    const targetsResult = await pool.query<TargetRow>(
        `
        SELECT
            ofn.id,
            ofn.id_toko,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            t.nama_toko,
            t.cabang,
            COALESCE(ofn.hari_denda, 0)::int AS hari_denda,
            COALESCE(ofn.nilai_denda, 0)::text AS nilai_denda,
            ofn.link_pdf_opname
        FROM opname_final ofn
        JOIN toko t ON t.id = ofn.id_toko
        WHERE UPPER(TRIM(COALESCE(t.cabang, ''))) <> 'HEAD OFFICE'
          AND COALESCE(ofn.hari_denda, 0) >= 11
          AND COALESCE(ofn.nilai_denda, 0) = 7500000
          AND NULLIF(TRIM(COALESCE(ofn.link_pdf_opname, '')), '') IS NOT NULL
        ORDER BY ofn.hari_denda DESC, ofn.id DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
    );

    const targets = targetsResult.rows;
    console.log("=== Regenerate Opname Final Denda PDFs ===");
    console.log(`Mode: ${commit ? "COMMIT" : "DRY RUN"}`);
    console.log(`Targets: ${targets.length} (limit=${limit}, offset=${offset})`);

    if (!commit) {
        const previewRows = targets.map<RunResult>((target) => ({
            ...target,
            status: "WOULD_REGENERATE",
            new_link_pdf_opname: null,
            error: null,
        }));
        const report = writeReport(previewRows);
        console.log(`Preview report: ${report}`);
        console.log("Dry run only. Re-run with --commit to regenerate and upload PDFs.");
        await pool.end();
        return;
    }

    await GoogleProvider.initialize();
    const results: RunResult[] = [];

    for (const target of targets) {
        try {
            console.log(`Regenerating opname_final #${target.id} (${target.nomor_ulok}/${target.lingkup_pekerjaan})...`);
            const regenerated = await opnameFinalService.refreshDendaAndPdfById(String(target.id));
            const verification = await pool.query<{ link_pdf_opname: string | null }>(
                "SELECT link_pdf_opname FROM opname_final WHERE id = $1",
                [target.id]
            );
            results.push({
                ...target,
                status: "REGENERATED",
                new_link_pdf_opname: verification.rows[0]?.link_pdf_opname ?? regenerated.link_pdf_opname,
                error: null,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed opname_final #${target.id}: ${message}`);
            results.push({
                ...target,
                status: "FAILED",
                new_link_pdf_opname: null,
                error: message,
            });
        }
    }

    const report = writeReport(results);
    const success = results.filter((row) => row.status === "REGENERATED").length;
    const failed = results.filter((row) => row.status === "FAILED").length;
    console.log("=== Done ===");
    console.log(`Regenerated: ${success}`);
    console.log(`Failed     : ${failed}`);
    console.log(`Report     : ${report}`);

    await pool.end();
}

main().catch(async (error) => {
    console.error("Fatal error:", error);
    await pool.end();
    process.exit(1);
});
