/**
 * VERIFY ALL AFFECTED ULOKs - National Holidays 2026
 * 
 * Cek 5 ULOK yang teridentifikasi terdampak libur nasional:
 * 1. 2JZ1-2603-0003
 * 2. ZZ01-2604-0067
 * 3. 3GZ1-2607-0003
 * 4. 2LZ1-2609-0003
 * 5. 8JZ1-2610-0024
 */

import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";

const AFFECTED_ULOKS = [
    "2JZ1-2603-0003",
    "ZZ01-2604-0067",
    "3GZ1-2607-0003",
    "2LZ1-2609-0003",
    "8JZ1-2610-0024"
];

async function verifyAll() {
    console.log("================================================================================");
    console.log("VERIFY ALL AFFECTED ULOKs - National Holidays 2026");
    console.log("================================================================================");
    console.log("");

    const results: Array<{
        ulok: string;
        toko_count: number;
        total_denda_db: number;
        total_denda_calc: number;
        status: string;
        details: any[];
    }> = [];

    for (const ulok of AFFECTED_ULOKS) {
        console.log("─".repeat(80));
        console.log(`ULOK: ${ulok}`);
        console.log("─".repeat(80));

        // Get all toko for this ULOK
        const tokos = await pool.query(`
            SELECT 
                t.id AS id_toko,
                t.nomor_ulok,
                t.nama_toko,
                t.lingkup_pekerjaan,
                t.cabang,
                ps.waktu_selesai::date AS spk_end,
                bst.created_at::date AS st_date,
                of.hari_denda AS db_hari_denda,
                of.nilai_denda AS db_nilai_denda
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            LEFT JOIN opname_final of ON of.id_toko = t.id
            WHERE t.nomor_ulok = $1
              AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
            ORDER BY t.id
        `, [ulok]);

        if (tokos.rows.length === 0) {
            console.log("❌ ULOK not found!");
            console.log("");
            continue;
        }

        const details: any[] = [];
        let totalDendaDb = 0;
        let totalDendaCalc = 0;

        for (const toko of tokos.rows) {
            const dbDenda = parseInt(toko.db_nilai_denda || 0);
            totalDendaDb += dbDenda;

            try {
                const calculated = await calculateDendaByTokoId(toko.id_toko);
                totalDendaCalc += calculated.nilai_denda;

                const match = dbDenda === calculated.nilai_denda;

                details.push({
                    id_toko: toko.id_toko,
                    nama_toko: toko.nama_toko,
                    lingkup: toko.lingkup_pekerjaan,
                    spk_end: toko.spk_end,
                    st_date: toko.st_date,
                    db_denda: dbDenda,
                    calc_denda: calculated.nilai_denda,
                    match: match
                });

                console.log(`Toko ${toko.id_toko} (${toko.lingkup_pekerjaan}):`);
                console.log(`  SPK End: ${toko.spk_end}, ST: ${toko.st_date}`);
                console.log(`  DB: Rp ${dbDenda.toLocaleString('id-ID')} (${toko.db_hari_denda} hari)`);
                console.log(`  Calc: Rp ${calculated.nilai_denda.toLocaleString('id-ID')} (${calculated.hari_denda} hari)`);
                console.log(`  ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
            } catch (error: any) {
                console.log(`  ❌ Error: ${error.message}`);
                details.push({
                    id_toko: toko.id_toko,
                    nama_toko: toko.nama_toko,
                    lingkup: toko.lingkup_pekerjaan,
                    error: error.message
                });
            }
        }

        const allMatch = details.every(d => d.match === true);
        const status = allMatch ? '✅ ALL SAFE' : '⚠️  NEEDS FIX';

        results.push({
            ulok,
            toko_count: tokos.rows.length,
            total_denda_db: totalDendaDb,
            total_denda_calc: totalDendaCalc,
            status,
            details
        });

        console.log("");
        console.log(`Summary: ${tokos.rows.length} toko(s)`);
        console.log(`  Total DB: Rp ${totalDendaDb.toLocaleString('id-ID')}`);
        console.log(`  Total Calc: Rp ${totalDendaCalc.toLocaleString('id-ID')}`);
        console.log(`  Status: ${status}`);
        console.log("");
    }

    // Summary Report
    console.log("================================================================================");
    console.log("SUMMARY REPORT");
    console.log("================================================================================");
    console.log("");

    let grandTotalDbBefore = 0;
    let grandTotalCalcAfter = 0;
    let safeCount = 0;
    let needsFixCount = 0;

    for (const result of results) {
        grandTotalDbBefore += result.total_denda_db;
        grandTotalCalcAfter += result.total_denda_calc;
        
        if (result.status.includes('SAFE')) {
            safeCount++;
        } else {
            needsFixCount++;
        }

        console.log(`${result.ulok}: ${result.status}`);
        console.log(`  Toko: ${result.toko_count}`);
        console.log(`  DB: Rp ${result.total_denda_db.toLocaleString('id-ID')}`);
        console.log(`  Calc: Rp ${result.total_denda_calc.toLocaleString('id-ID')}`);
        
        if (result.total_denda_db !== result.total_denda_calc) {
            console.log(`  Difference: Rp ${Math.abs(result.total_denda_db - result.total_denda_calc).toLocaleString('id-ID')}`);
        }
        console.log("");
    }

    console.log("─".repeat(80));
    console.log(`Total ULOKs checked: ${AFFECTED_ULOKS.length}`);
    console.log(`✅ Safe: ${safeCount}`);
    console.log(`⚠️  Needs fix: ${needsFixCount}`);
    console.log("");
    console.log(`Grand Total (DB): Rp ${grandTotalDbBefore.toLocaleString('id-ID')}`);
    console.log(`Grand Total (Calc): Rp ${grandTotalCalcAfter.toLocaleString('id-ID')}`);
    console.log(`Total Savings: Rp ${Math.abs(grandTotalDbBefore - grandTotalCalcAfter).toLocaleString('id-ID')}`);
    console.log("");

    if (needsFixCount === 0) {
        console.log("✅ ALL DATA SAFE - No fixes needed!");
    } else {
        console.log(`⚠️  ${needsFixCount} ULOK(s) need database update!`);
    }

    console.log("================================================================================");
}

verifyAll()
    .then(() => {
        console.log("✅ Verification complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
