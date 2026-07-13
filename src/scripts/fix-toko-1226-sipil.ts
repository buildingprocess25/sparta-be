/**
 * FIX: Update opname_final untuk Toko 1226 (SIPIL) - ULOK 2JZ1-2603-0003
 * 
 * Issue: Toko 1226 (SIPIL) masih punya denda 1 hari, padahal seharusnya 0
 * Toko 1243 (ME) sudah correct
 */

import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";

async function fixToko1226() {
    console.log("================================================================================");
    console.log("FIX: Update opname_final untuk Toko 1226 (SIPIL)");
    console.log("================================================================================");
    console.log("");

    const idToko = 1226;

    // 1. Check current state
    console.log("STEP 1: Check current state");
    console.log("-".repeat(80));
    
    const current = await pool.query(`
        SELECT 
            t.id,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            of.id AS opname_id,
            of.hari_denda,
            of.nilai_denda,
            of.tanggal_akhir_spk_denda,
            of.tanggal_serah_terima_denda
        FROM toko t
        LEFT JOIN opname_final of ON of.id_toko = t.id
        WHERE t.id = $1
    `, [idToko]);

    if (current.rows.length === 0) {
        console.log("❌ Toko not found!");
        return;
    }

    const row = current.rows[0];
    console.log(`Toko: ${row.nama_toko} (${row.lingkup_pekerjaan})`);
    console.log(`ULOK: ${row.nomor_ulok}`);
    console.log("");
    console.log("Current Database:");
    console.log(`  Hari Denda: ${row.hari_denda}`);
    console.log(`  Nilai Denda: Rp ${parseInt(row.nilai_denda || 0).toLocaleString('id-ID')}`);
    console.log(`  Tanggal Akhir SPK: ${row.tanggal_akhir_spk_denda}`);
    console.log(`  Tanggal ST: ${row.tanggal_serah_terima_denda}`);
    console.log("");

    // 2. Calculate correct denda
    console.log("STEP 2: Calculate correct denda");
    console.log("-".repeat(80));
    
    const calculated = await calculateDendaByTokoId(idToko);
    console.log("Calculated (with national holidays):");
    console.log(`  Hari Denda: ${calculated.hari_denda}`);
    console.log(`  Nilai Denda: Rp ${calculated.nilai_denda.toLocaleString('id-ID')}`);
    console.log(`  Tanggal Akhir SPK: ${calculated.tanggal_akhir_spk}`);
    console.log(`  Tanggal ST: ${calculated.tanggal_serah_terima}`);
    console.log("");

    // 3. Compare
    const needsUpdate = row.hari_denda !== calculated.hari_denda || 
                       parseInt(row.nilai_denda || 0) !== calculated.nilai_denda;

    if (!needsUpdate) {
        console.log("✅ Database already correct, no update needed!");
        return;
    }

    console.log("❌ MISMATCH DETECTED - need update!");
    console.log("");

    // 4. Update database
    console.log("STEP 3: Update database");
    console.log("-".repeat(80));

    if (!row.opname_id) {
        console.log("❌ No opname_final record found - cannot update!");
        return;
    }

    const updateResult = await pool.query(`
        UPDATE opname_final
        SET 
            hari_denda = $1,
            nilai_denda = $2,
            tanggal_akhir_spk_denda = $3,
            tanggal_serah_terima_denda = $4
        WHERE id = $5
        RETURNING id, hari_denda, nilai_denda
    `, [
        calculated.hari_denda,
        String(calculated.nilai_denda),
        calculated.tanggal_akhir_spk,
        calculated.tanggal_serah_terima,
        row.opname_id
    ]);

    console.log("✅ Updated opname_final:");
    console.log(`  Record ID: ${updateResult.rows[0].id}`);
    console.log(`  New Hari Denda: ${updateResult.rows[0].hari_denda}`);
    console.log(`  New Nilai Denda: Rp ${parseInt(updateResult.rows[0].nilai_denda).toLocaleString('id-ID')}`);
    console.log("");

    // 5. Verify
    console.log("STEP 4: Verify update");
    console.log("-".repeat(80));

    const verify = await pool.query(`
        SELECT hari_denda, nilai_denda, tanggal_akhir_spk_denda, tanggal_serah_terima_denda
        FROM opname_final
        WHERE id_toko = $1
    `, [idToko]);

    const verified = verify.rows[0];
    console.log("Verified Database:");
    console.log(`  Hari Denda: ${verified.hari_denda}`);
    console.log(`  Nilai Denda: Rp ${parseInt(verified.nilai_denda).toLocaleString('id-ID')}`);
    console.log(`  Tanggal Akhir SPK: ${verified.tanggal_akhir_spk_denda}`);
    console.log(`  Tanggal ST: ${verified.tanggal_serah_terima_denda}`);
    console.log("");

    if (verified.hari_denda === calculated.hari_denda && 
        parseInt(verified.nilai_denda) === calculated.nilai_denda) {
        console.log("✅ VERIFICATION PASSED!");
    } else {
        console.log("❌ VERIFICATION FAILED!");
    }

    console.log("");
    console.log("================================================================================");
    console.log("SUMMARY");
    console.log("================================================================================");
    console.log("");
    console.log(`Toko 1226 (SIPIL) - ULOK 2JZ1-2603-0003:`);
    console.log(`  Before: Rp ${parseInt(row.nilai_denda || 0).toLocaleString('id-ID')} (${row.hari_denda} hari)`);
    console.log(`  After:  Rp ${calculated.nilai_denda.toLocaleString('id-ID')} (${calculated.hari_denda} hari)`);
    console.log(`  Savings: Rp ${Math.abs(parseInt(row.nilai_denda || 0) - calculated.nilai_denda).toLocaleString('id-ID')}`);
    console.log("");
    console.log("Reason:");
    console.log("  SPK End: 29 Mei 2026 (Jumat)");
    console.log("  Skip: Sabtu 30, Minggu 31, Senin 1 Jun (Libur Nasional)");
    console.log("  Grace Period: Selasa 2 Jun 2026");
    console.log("  ST Date: Selasa 2 Jun 2026");
    console.log("  Result: ST di grace period = 0 hari denda");
    console.log("");
    console.log("✅ DONE!");
    console.log("================================================================================");
}

fixToko1226()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
