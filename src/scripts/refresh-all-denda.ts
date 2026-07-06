/**
 * Bulk refresh script: re-applies the denda calculation to opname_final records.
 *
 * Preview: npx tsx src/scripts/refresh-all-denda.ts
 * Commit : npx tsx src/scripts/refresh-all-denda.ts --commit
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";

dotenv.config({ path: path.join(__dirname, "../../sparta-be.env") });

type OpnameFinalIdRow = {
    id: number;
    id_toko: number;
    status_opname_final: string | null;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    hari_denda: number | null;
    nilai_denda: string | null;
};

type HeadOfficeDendaRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string | null;
    lingkup_pekerjaan: string | null;
    hari_denda: number | null;
    nilai_denda: string | null;
};

async function main() {
    const commit = process.argv.includes("--commit");

    console.log("=== Bulk Denda Refresh Script ===");
    console.log(`Mode: ${commit ? "COMMIT" : "DRY RUN"}\n`);
    console.log("Fetching non-HEAD OFFICE opname_final records...\n");

    const result = await pool.query<OpnameFinalIdRow>(`
        SELECT ofn.id, ofn.id_toko, ofn.status_opname_final, ofn.hari_denda, ofn.nilai_denda,
               t.nomor_ulok, t.lingkup_pekerjaan
        FROM opname_final ofn
        JOIN toko t ON t.id = ofn.id_toko
        WHERE UPPER(TRIM(COALESCE(t.cabang, ''))) <> 'HEAD OFFICE'
        ORDER BY t.nomor_ulok ASC, t.lingkup_pekerjaan ASC, ofn.id DESC
    `);

    const rows = result.rows;
    console.log(`Found ${rows.length} non-HEAD OFFICE opname_final records to process.\n`);

    let changed = 0;
    let unchanged = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
        try {
            const denda = await calculateDendaByTokoId(row.id_toko);
            const prevHari = row.hari_denda ?? 0;
            const prevNilai = Number(row.nilai_denda ?? 0);

            if (denda.hari_denda === 0 && denda.tanggal_akhir_spk === null && prevHari > 0) {
                console.log(
                    `  [SKIP] opname_final #${row.id} (toko ${row.id_toko} ${row.nomor_ulok}/${row.lingkup_pekerjaan}): ` +
                    `no SPK data found, keeping existing=${prevHari} hari / Rp${prevNilai.toLocaleString()}`
                );
                skipped++;
                continue;
            }

            const isChanged = prevHari !== denda.hari_denda || prevNilai !== denda.nilai_denda;

            if (commit && isChanged) {
                await pool.query(
                    `UPDATE opname_final
                     SET hari_denda = $1,
                         nilai_denda = $2,
                         tanggal_akhir_spk_denda = $3,
                         tanggal_serah_terima_denda = $4
                     WHERE id = $5`,
                    [denda.hari_denda, denda.nilai_denda, denda.tanggal_akhir_spk, denda.tanggal_serah_terima, row.id]
                );
            }

            const marker = isChanged ? (commit ? "UPDATED" : "WOULD UPDATE") : "same";
            console.log(
                `  [${marker}] opname_final #${row.id} (toko ${row.id_toko} ${row.nomor_ulok}/${row.lingkup_pekerjaan}): ` +
                `${prevHari} -> ${denda.hari_denda} hari, Rp${prevNilai.toLocaleString()} -> Rp${denda.nilai_denda.toLocaleString()}`
            );

            if (isChanged) changed++;
            else unchanged++;
        } catch (err) {
            console.error(`  [ERROR] opname_final #${row.id} (toko ${row.id_toko}):`, err);
            errors++;
        }
    }

    const headOfficeResult = await pool.query<HeadOfficeDendaRow>(`
        SELECT ofn.id, ofn.id_toko, ofn.hari_denda, ofn.nilai_denda,
               t.nomor_ulok, t.lingkup_pekerjaan
        FROM opname_final ofn
        JOIN toko t ON t.id = ofn.id_toko
        WHERE UPPER(TRIM(COALESCE(t.cabang, ''))) = 'HEAD OFFICE'
          AND (COALESCE(ofn.hari_denda, 0) <> 0 OR COALESCE(ofn.nilai_denda, 0) <> 0)
        ORDER BY ofn.id DESC
    `);

    if (headOfficeResult.rows.length > 0) {
        console.log(`\nHead Office denda rows to clear: ${headOfficeResult.rows.length}`);
        for (const row of headOfficeResult.rows) {
            const prevHari = row.hari_denda ?? 0;
            const prevNilai = Number(row.nilai_denda ?? 0);

            if (commit) {
                await pool.query(
                    `UPDATE opname_final
                     SET hari_denda = 0,
                         nilai_denda = 0,
                         tanggal_akhir_spk_denda = NULL,
                         tanggal_serah_terima_denda = NULL
                     WHERE id = $1`,
                    [row.id]
                );
            }

            console.log(
                `  [${commit ? "CLEARED" : "WOULD CLEAR"}] opname_final #${row.id} ` +
                `(toko ${row.id_toko} ${row.nomor_ulok}/${row.lingkup_pekerjaan}): ` +
                `${prevHari} -> 0 hari, Rp${prevNilai.toLocaleString()} -> Rp0`
            );
        }
    }

    console.log("\n=== Done ===");
    console.log(`  Changed non-HO : ${changed}`);
    console.log(`  Unchanged      : ${unchanged}`);
    console.log(`  Skipped        : ${skipped}`);
    console.log(`  HO to clear    : ${headOfficeResult.rows.length}`);
    console.log(`  Errors         : ${errors}`);
    if (!commit) {
        console.log("\nDry run only. Re-run with --commit to write these changes.");
    }

    await pool.end();
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
