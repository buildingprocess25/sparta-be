/**
 * Bulk refresh script: re-applies the updated denda calculation (minimum across Sipil+ME peers)
 * to all opname_final records that are in an active/approved state.
 *
 * Run: npx tsx src/scripts/refresh-all-denda.ts
 */
import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";
import * as dotenv from "dotenv";
import * as path from "path";

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

async function main() {
    console.log("=== Bulk Denda Refresh Script ===");
    console.log("Fetching all opname_final records...\n");

    const result = await pool.query<OpnameFinalIdRow>(`
        SELECT ofn.id, ofn.id_toko, ofn.status_opname_final, ofn.hari_denda, ofn.nilai_denda,
               t.nomor_ulok, t.lingkup_pekerjaan
        FROM opname_final ofn
        JOIN toko t ON t.id = ofn.id_toko
        ORDER BY t.nomor_ulok ASC, t.lingkup_pekerjaan ASC, ofn.id DESC
    `);

    const rows = result.rows;
    console.log(`Found ${rows.length} opname_final records to process.\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
        try {
            const denda = await calculateDendaByTokoId(row.id_toko);

            const prevHari = row.hari_denda ?? 0;
            const prevNilai = Number(row.nilai_denda ?? 0);

            // Only skip if calculation has no data (no SPK and no tanggal_akhir_spk)
            if (denda.hari_denda === 0 && denda.tanggal_akhir_spk === null) {
                // If we have existing valid data and no calculation base, keep existing
                if (prevHari > 0) {
                    console.log(
                        `  [SKIP] opname_final #${row.id} (toko ${row.id_toko} ${row.nomor_ulok}/${row.lingkup_pekerjaan}): ` +
                        `no SPK data found, keeping existing=${prevHari} hari / Rp${prevNilai.toLocaleString()}`
                    );
                    skipped++;
                    continue;
                }
            }

            await pool.query(
                `UPDATE opname_final
                 SET hari_denda = $1,
                     nilai_denda = $2,
                     tanggal_akhir_spk_denda = $3,
                     tanggal_serah_terima_denda = $4
                 WHERE id = $5`,
                [denda.hari_denda, denda.nilai_denda, denda.tanggal_akhir_spk, denda.tanggal_serah_terima, row.id]
            );

            const changed = prevHari !== denda.hari_denda || prevNilai !== denda.nilai_denda;
            const marker = changed ? "✅ UPDATED" : "   same";
            console.log(
                `  [${marker}] opname_final #${row.id} (toko ${row.id_toko} ${row.nomor_ulok}/${row.lingkup_pekerjaan}): ` +
                `${prevHari} → ${denda.hari_denda} hari, Rp${prevNilai.toLocaleString()} → Rp${denda.nilai_denda.toLocaleString()}`
            );

            updated++;
        } catch (err) {
            console.error(`  [ERROR] opname_final #${row.id} (toko ${row.id_toko}):`, err);
            errors++;
        }
    }

    console.log(`\n=== Done ===`);
    console.log(`  Updated : ${updated}`);
    console.log(`  Skipped : ${skipped}`);
    console.log(`  Errors  : ${errors}`);

    await pool.end();
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
