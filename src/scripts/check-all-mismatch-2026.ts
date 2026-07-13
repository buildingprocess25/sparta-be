/**
 * CHECK ALL MISMATCHES 2026
 * Cari records yang DB tidak match dengan calculation
 */

import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";

async function checkMismatches() {
    console.log("================================================================================");
    console.log("CHECK ALL MISMATCHES 2026");
    console.log("================================================================================");
    console.log("");

    // Get all 2026 records with ST
    const result = await pool.query(`
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
        WHERE EXTRACT(YEAR FROM ps.waktu_selesai) = 2026
          AND bst.created_at IS NOT NULL
          AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
        ORDER BY t.nomor_ulok, t.id
    `);

    console.log(`Checking ${result.rows.length} records...`);
    console.log("");

    const mismatches: any[] = [];
    let checkedCount = 0;

    for (const row of result.rows) {
        checkedCount++;
        
        if (checkedCount % 50 === 0) {
            console.log(`Progress: ${checkedCount}/${result.rows.length}...`);
        }

        try {
            const calculated = await calculateDendaByTokoId(row.id_toko);
            const dbDenda = parseInt(row.db_nilai_denda || 0);
            
            if (dbDenda !== calculated.nilai_denda) {
                mismatches.push({
                    ulok: row.nomor_ulok,
                    id_toko: row.id_toko,
                    nama_toko: row.nama_toko,
                    lingkup: row.lingkup_pekerjaan,
                    cabang: row.cabang,
                    spk_end: row.spk_end,
                    st_date: row.st_date,
                    db_hari_denda: row.db_hari_denda,
                    db_nilai_denda: dbDenda,
                    calc_hari_denda: calculated.hari_denda,
                    calc_nilai_denda: calculated.nilai_denda,
                    difference: Math.abs(dbDenda - calculated.nilai_denda)
                });
            }
        } catch (error: any) {
            // Skip errors
        }
    }

    console.log("");
    console.log("================================================================================");
    console.log("MISMATCHES FOUND");
    console.log("================================================================================");
    console.log("");

    if (mismatches.length === 0) {
        console.log("✅ NO MISMATCHES FOUND - All data is correct!");
    } else {
        console.log(`Found ${mismatches.length} mismatch(es):`);
        console.log("");

        for (const m of mismatches) {
            console.log(`❌ ${m.ulok} - ${m.nama_toko} (${m.lingkup})`);
            console.log(`   Toko ID: ${m.id_toko}, Cabang: ${m.cabang}`);
            console.log(`   SPK End: ${m.spk_end}, ST: ${m.st_date}`);
            console.log(`   DB: Rp ${m.db_nilai_denda.toLocaleString('id-ID')} (${m.db_hari_denda} hari)`);
            console.log(`   Calc: Rp ${m.calc_nilai_denda.toLocaleString('id-ID')} (${m.calc_hari_denda} hari)`);
            console.log(`   Diff: Rp ${m.difference.toLocaleString('id-ID')}`);
            console.log("");
        }

        console.log("─".repeat(80));
        console.log("Summary by ULOK:");
        console.log("");

        const byUlok = new Map<string, any[]>();
        for (const m of mismatches) {
            if (!byUlok.has(m.ulok)) {
                byUlok.set(m.ulok, []);
            }
            byUlok.get(m.ulok)!.push(m);
        }

        for (const [ulok, records] of byUlok.entries()) {
            const totalDbDenda = records.reduce((sum, r) => sum + r.db_nilai_denda, 0);
            const totalCalcDenda = records.reduce((sum, r) => sum + r.calc_nilai_denda, 0);
            const totalDiff = Math.abs(totalDbDenda - totalCalcDenda);

            console.log(`${ulok}: ${records.length} toko(s)`);
            console.log(`  DB: Rp ${totalDbDenda.toLocaleString('id-ID')}`);
            console.log(`  Calc: Rp ${totalCalcDenda.toLocaleString('id-ID')}`);
            console.log(`  Savings: Rp ${totalDiff.toLocaleString('id-ID')}`);
            console.log("");
        }
    }

    console.log("================================================================================");
    console.log("SUMMARY");
    console.log("================================================================================");
    console.log("");
    console.log(`Total records checked: ${checkedCount}`);
    console.log(`Mismatches found: ${mismatches.length}`);
    console.log(`Match rate: ${((checkedCount - mismatches.length) / checkedCount * 100).toFixed(2)}%`);
    console.log("");

    if (mismatches.length > 0) {
        const totalSavings = mismatches.reduce((sum, m) => sum + m.difference, 0);
        console.log(`Total potential savings: Rp ${totalSavings.toLocaleString('id-ID')}`);
    }

    console.log("================================================================================");
}

checkMismatches()
    .then(() => {
        console.log("✅ Check complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
