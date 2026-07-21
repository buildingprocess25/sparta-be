/**
 * Regenerate linked PDF documents after volume display formatting changes.
 *
 * Preview:
 *   npx tsx src/scripts/backfill-linked-pdfs-volume-format.ts
 *
 * Commit:
 *   npx tsx src/scripts/backfill-linked-pdfs-volume-format.ts --commit --limit=0
 *
 * Optional:
 *   --only=rab,opname,il,st
 *   --limit=50
 *   --offset=0
 */
import dotenv from "dotenv";
import path from "path";
import { GoogleProvider } from "../common/google";
import { pool } from "../db/pool";
import { instruksiLapanganService } from "../modules/instruksi-lapangan/instruksi-lapangan.service";
import { opnameFinalService } from "../modules/opname-final/opname-final.service";
import { rabService } from "../modules/rab/rab.service";
import { serahTerimaService } from "../modules/serah-terima/serah-terima.service";

dotenv.config({ path: path.join(__dirname, "../../sparta-be.env") });

type DocKind = "rab" | "opname" | "il" | "st";
type Target = {
    kind: DocKind;
    id: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    old_link: string | null;
};

const getArgValue = (name: string): string | null => {
    const prefix = `${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
};

const parseOnlyKinds = (): Set<DocKind> => {
    const raw = getArgValue("--only");
    if (!raw) return new Set(["rab", "opname", "il", "st"]);
    const kinds = raw.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    const valid = new Set<DocKind>();
    for (const kind of kinds) {
        if (kind === "rab" || kind === "opname" || kind === "il" || kind === "st") {
            valid.add(kind);
        }
    }
    if (valid.size === 0) {
        throw new Error("Argumen --only tidak valid. Pakai rab,opname,il,st.");
    }
    return valid;
};

const applyLimitOffset = (sql: string, limit: number, offset: number): string => {
    const paging = limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : "";
    return `${sql}\n${paging}`;
};

const queryTargets = async (kind: DocKind, limit: number, offset: number): Promise<Target[]> => {
    if (kind === "rab") {
        const result = await pool.query<Target>(applyLimitOffset(`
            SELECT
                'rab'::text AS kind,
                r.id,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                r.link_pdf_gabungan AS old_link
            FROM rab r
            JOIN toko t ON t.id = r.id_toko
            WHERE NULLIF(TRIM(COALESCE(r.link_pdf_gabungan, '')), '') IS NOT NULL
               OR NULLIF(TRIM(COALESCE(r.link_pdf_non_sbo, '')), '') IS NOT NULL
               OR NULLIF(TRIM(COALESCE(r.link_pdf_rekapitulasi, '')), '') IS NOT NULL
               OR NULLIF(TRIM(COALESCE(r.link_pdf_sph, '')), '') IS NOT NULL
            ORDER BY r.id
        `, limit, offset));
        return result.rows;
    }

    if (kind === "opname") {
        const result = await pool.query<Target>(applyLimitOffset(`
            SELECT
                'opname'::text AS kind,
                ofn.id,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                ofn.link_pdf_opname AS old_link
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE NULLIF(TRIM(COALESCE(ofn.link_pdf_opname, '')), '') IS NOT NULL
            ORDER BY ofn.id
        `, limit, offset));
        return result.rows;
    }

    if (kind === "il") {
        const result = await pool.query<Target>(applyLimitOffset(`
            SELECT
                'il'::text AS kind,
                il.id,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                il.link_pdf_gabungan AS old_link
            FROM instruksi_lapangan il
            JOIN toko t ON t.id = il.id_toko
            WHERE NULLIF(TRIM(COALESCE(il.link_pdf_gabungan, '')), '') IS NOT NULL
               OR NULLIF(TRIM(COALESCE(il.link_pdf_non_sbo, '')), '') IS NOT NULL
               OR NULLIF(TRIM(COALESCE(il.link_pdf_rekapitulasi, '')), '') IS NOT NULL
            ORDER BY il.id
        `, limit, offset));
        return result.rows;
    }

    const result = await pool.query<Target>(applyLimitOffset(`
        SELECT
            'st'::text AS kind,
            bst.id,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            bst.link_pdf AS old_link
        FROM berkas_serah_terima bst
        JOIN toko t ON t.id = bst.id_toko
        WHERE NULLIF(TRIM(COALESCE(bst.link_pdf, '')), '') IS NOT NULL
        ORDER BY bst.id
    `, limit, offset));
    return result.rows;
};

const regenerateTarget = async (target: Target): Promise<void> => {
    if (target.kind === "rab") {
        await rabService.regeneratePdf(String(target.id));
        return;
    }
    if (target.kind === "opname") {
        await opnameFinalService.refreshDendaAndPdfById(String(target.id));
        return;
    }
    if (target.kind === "il") {
        await instruksiLapanganService.generateAndStorePdf(String(target.id));
        return;
    }
    await serahTerimaService.regeneratePdfByBerkasId(target.id);
};

const main = async () => {
    const commit = process.argv.includes("--commit");
    const limit = Math.max(0, Number(getArgValue("--limit") ?? 50));
    const offset = Math.max(0, Number(getArgValue("--offset") ?? 0));
    const kinds = parseOnlyKinds();

    const targetsByKind = new Map<DocKind, Target[]>();
    for (const kind of kinds) {
        targetsByKind.set(kind, await queryTargets(kind, limit, offset));
    }

    console.log("=== Backfill linked PDFs volume format ===");
    console.log(`Mode  : ${commit ? "COMMIT" : "DRY RUN"}`);
    console.log(`Limit : ${limit === 0 ? "ALL" : limit}`);
    console.log(`Offset: ${offset}`);

    for (const [kind, targets] of targetsByKind) {
        console.log(`${kind.toUpperCase().padEnd(6)}: ${targets.length} target`);
        for (const target of targets.slice(0, 10)) {
            console.log(`  - ${target.kind} #${target.id} ${target.nomor_ulok ?? "-"} / ${target.lingkup_pekerjaan ?? "-"}`);
        }
        if (targets.length > 10) console.log(`  ... ${targets.length - 10} target lainnya`);
    }

    if (!commit) {
        console.log("Dry run selesai. Tambahkan --commit untuk regenerate/upload dan update link.");
        return;
    }

    await GoogleProvider.initialize();
    let success = 0;
    let failed = 0;

    for (const [kind, targets] of targetsByKind) {
        for (const target of targets) {
            try {
                console.log(`Regenerating ${kind} #${target.id} (${target.nomor_ulok ?? "-"}/${target.lingkup_pekerjaan ?? "-"})...`);
                await regenerateTarget(target);
                success += 1;
            } catch (error) {
                failed += 1;
                const message = error instanceof Error ? error.message : String(error);
                console.error(`FAILED ${kind} #${target.id}: ${message}`);
            }
        }
    }

    console.log("=== Done ===");
    console.log(`Success: ${success}`);
    console.log(`Failed : ${failed}`);
};

main()
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
