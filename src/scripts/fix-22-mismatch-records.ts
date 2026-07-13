/**
 * FIX 22 MISMATCH RECORDS - Peer Minimum Logic
 * 
 * Update opname_final untuk 22 toko SIPIL yang harusnya dapat
 * peer minimum dari ME (denda lebih kecil)
 */

import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";

// 22 Toko IDs yang perlu di-fix
const MISMATCH_TOKO_IDS = [
    1108, // 1DZ1-2601-0001-R
    1009, // 1JZ1-2602-0001
    1572, // 1JZ1-2604-0001
    1599, // 1JZ1-2605-1J3U-R
    1376, // 1MZ1-2604-1M4P-R
    1446, // 1YZ1-2604-0001
    1218, // 2AZ1-2602-0001
    975,  // 2DZ1-2601-0002
    1004, // 2DZ1-2601-0003-R
    1370, // 2PZ1-2508-0007
    1310, // 2SZ1-2603-0001-R
    1324, // 2SZ1-2603-0002
    1495, // 2VZ1-2604-0001-R
    1627, // CZ01-2603-0001
    1751, // CZ01-2603-0002
    1355, // CZ01-2603-0003
    1213, // UZ01-2602-0010
    1553, // UZ01-2603-0021
    1460, // WZ01-2602-0010
    1273, // WZ01-2602-0026
    1890, // WZ01-2604-0009 (special case)
    780   // XZ01-2512-0002
];

async function fixMismatchRecords() {
    console.log("================================================================================");
    console.log("FIX 22 MISMATCH RECORDS - Peer Minimum Logic");
    console.log("================================================================================");
    console.log("");
    console.log(`Target: ${MISMATCH_TOKO_IDS.length} records`);
    console.log("");

    let successCount = 0;
    let errorCount = 0;
    let totalSavingsBefore = 0;
    let totalSavingsAfter = 0;
    const results: any[] = [];

    for (const idToko of MISMATCH_TOKO_IDS) {
        console.log("─".repeat(80));
        
        try {
            // 1. Get current data
            const current = await pool.query(`
                SELECT 
                    t.id,
                    t.nomor_ulok,
                    t.nama_toko,
                    t.lingkup_pekerjaan,
                    t.cabang,
                    of.id AS opname_id,
                    of.hari_denda AS old_hari_denda,
                    of.nilai_denda AS old_nilai_denda
                FROM toko t
                LEFT JOIN opname_final of ON of.id_toko = t.id
                WHERE t.id = $1
            `, [idToko]);

            if (current.rows.length === 0) {
                console.log(`❌ Toko ${idToko} not found!`);
                errorCount++;
                continue;
            }

            const row = current.rows[0];
            const oldDenda = parseInt(row.old_nilai_denda || 0);
            totalSavingsBefore += oldDenda;

            console.log(`Toko ${row.id}: ${row.nomor_ulok} - ${row.nama_toko} (${row.lingkup_pekerjaan})`);
            console.log(`  Cabang: ${row.cabang}`);
            console.log(`  Old: Rp ${oldDenda.toLocaleString('id-ID')} (${row.old_hari_denda} hari)`);

            // 2. Calculate peer minimum
            const calculated = await calculateDendaByTokoId(idToko);
            totalSavingsAfter += calculated.nilai_denda;

            console.log(`  New: Rp ${calculated.nilai_denda.toLocaleString('id-ID')} (${calculated.hari_denda} hari)`);
            console.log(`  Savings: Rp ${(oldDenda - calculated.nilai_denda).toLocaleString('id-ID')}`);

            // 3. Update database (only if different)
            if (oldDenda !== calculated.nilai_denda || row.old_hari_denda !== calculated.hari_denda) {
                if (!row.opname_id) {
                    console.log(`  ⚠️  No opname_final record - skipping`);
                    errorCount++;
                    continue;
                }

                const updateResult = await pool.query(`
                    UPDATE opname_final
                    SET 
                        hari_denda = $1,
                        nilai_denda = $2,
                        tanggal_akhir_spk_denda = $3,
                        tanggal_serah_terima_denda = $4
                    WHERE id = $5
                    RETURNING id
                `, [
                    calculated.hari_denda,
                    String(calculated.nilai_denda),
                    calculated.tanggal_akhir_spk,
                    calculated.tanggal_serah_terima,
                    row.opname_id
                ]);

                if (updateResult.rowCount === 1) {
                    console.log(`  ✅ Updated opname_final ID ${row.opname_id}`);
                    successCount++;

                    results.push({
                        id_toko: row.id,
                        ulok: row.nomor_ulok,
                        nama_toko: row.nama_toko,
                        cabang: row.cabang,
                        old_denda: oldDenda,
                        new_denda: calculated.nilai_denda,
                        savings: oldDenda - calculated.nilai_denda
                    });
                } else {
                    console.log(`  ❌ Update failed`);
                    errorCount++;
                }
            } else {
                console.log(`  ✅ Already correct - no update needed`);
                successCount++;
            }

        } catch (error: any) {
            console.log(`  ❌ Error: ${error.message}`);
            errorCount++;
        }

        console.log("");
    }

    // Summary
    console.log("================================================================================");
    console.log("SUMMARY");
    console.log("================================================================================");
    console.log("");
    console.log(`Total records: ${MISMATCH_TOKO_IDS.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("");
    console.log(`Total Denda Before: Rp ${totalSavingsBefore.toLocaleString('id-ID')}`);
    console.log(`Total Denda After: Rp ${totalSavingsAfter.toLocaleString('id-ID')}`);
    console.log(`Total Savings: Rp ${(totalSavingsBefore - totalSavingsAfter).toLocaleString('id-ID')}`);
    console.log("");

    if (results.length > 0) {
        console.log("Updated Records:");
        console.log("─".repeat(80));
        
        // Group by cabang
        const byCabang = new Map<string, any[]>();
        for (const r of results) {
            if (!byCabang.has(r.cabang)) {
                byCabang.set(r.cabang, []);
            }
            byCabang.get(r.cabang)!.push(r);
        }

        for (const [cabang, records] of byCabang.entries()) {
            const totalSavings = records.reduce((sum, r) => sum + r.savings, 0);
            console.log(`${cabang}: ${records.length} record(s), Savings: Rp ${totalSavings.toLocaleString('id-ID')}`);
            
            for (const r of records) {
                console.log(`  - ${r.ulok}: Rp ${r.old_denda.toLocaleString('id-ID')} → Rp ${r.new_denda.toLocaleString('id-ID')}`);
            }
            console.log("");
        }
    }

    console.log("================================================================================");
    console.log("VERIFICATION");
    console.log("================================================================================");
    console.log("");
    console.log("Re-checking all 22 records...");
    console.log("");

    let verifyOk = 0;
    let verifyFail = 0;

    for (const idToko of MISMATCH_TOKO_IDS) {
        try {
            const dbCheck = await pool.query(`
                SELECT 
                    t.nomor_ulok,
                    of.hari_denda,
                    of.nilai_denda
                FROM toko t
                LEFT JOIN opname_final of ON of.id_toko = t.id
                WHERE t.id = $1
            `, [idToko]);

            if (dbCheck.rows.length > 0) {
                const calculated = await calculateDendaByTokoId(idToko);
                const dbDenda = parseInt(dbCheck.rows[0].nilai_denda || 0);
                
                if (dbDenda === calculated.nilai_denda) {
                    verifyOk++;
                    console.log(`✅ ${dbCheck.rows[0].nomor_ulok}: Rp ${dbDenda.toLocaleString('id-ID')}`);
                } else {
                    verifyFail++;
                    console.log(`❌ ${dbCheck.rows[0].nomor_ulok}: DB=${dbDenda}, Calc=${calculated.nilai_denda}`);
                }
            }
        } catch (error: any) {
            console.log(`❌ Toko ${idToko}: ${error.message}`);
            verifyFail++;
        }
    }

    console.log("");
    console.log("─".repeat(80));
    console.log(`Verification: ${verifyOk}/${MISMATCH_TOKO_IDS.length} OK`);
    
    if (verifyFail === 0) {
        console.log("✅ ALL RECORDS VERIFIED CORRECT!");
    } else {
        console.log(`⚠️  ${verifyFail} record(s) still have issues`);
    }

    console.log("");
    console.log("================================================================================");
}

fixMismatchRecords()
    .then(() => {
        console.log("✅ Fix complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
