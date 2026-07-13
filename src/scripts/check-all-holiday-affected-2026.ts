/**
 * CHECK ALL HOLIDAY-AFFECTED RECORDS 2026
 * 
 * Cari semua SPK yang ST-nya jatuh di periode grace period yang ada libur nasional
 */

import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";
import { NATIONAL_HOLIDAYS_2026, isWeekend } from "../common/national-holidays";

async function checkAll() {
    console.log("================================================================================");
    console.log("CHECK ALL HOLIDAY-AFFECTED RECORDS 2026");
    console.log("================================================================================");
    console.log("");

    // Get all 2026 records with ST date
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
        ORDER BY bst.created_at, t.nomor_ulok, t.id
    `);

    console.log(`Total records found: ${result.rows.length}`);
    console.log("");

    const affectedRecords: any[] = [];
    const safeRecords: any[] = [];
    let mismatchCount = 0;

    for (const row of result.rows) {
        const spkEnd = new Date(row.spk_end);
        const stDate = new Date(row.st_date);
        
        // Check if there's any national holiday between SPK end and ST
        let hasHolidayInRange = false;
        const daysInRange: string[] = [];
        
        let checkDate = new Date(spkEnd);
        checkDate.setDate(checkDate.getDate() + 1); // Start from day after SPK end
        
        while (checkDate <= stDate) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const dayName = checkDate.toLocaleDateString('id-ID', { weekday: 'short' });
            
            if (isWeekend(checkDate)) {
                daysInRange.push(`${dateStr}(${dayName}-WE)`);
            } else {
                const holiday = NATIONAL_HOLIDAYS_2026.find(h => h.date === dateStr);
                if (holiday) {
                    hasHolidayInRange = true;
                    daysInRange.push(`${dateStr}(${dayName}-LIB:${holiday.description.substring(0, 20)})`);
                }
            }
            
            checkDate.setDate(checkDate.getDate() + 1);
        }

        if (hasHolidayInRange || daysInRange.length > 0) {
            // This record potentially affected by national holiday
            try {
                const calculated = await calculateDendaByTokoId(row.id_toko);
                const dbDenda = parseInt(row.db_nilai_denda || 0);
                const match = dbDenda === calculated.nilai_denda;

                if (!match) {
                    mismatchCount++;
                }

                affectedRecords.push({
                    ulok: row.nomor_ulok,
                    id_toko: row.id_toko,
                    nama_toko: row.nama_toko,
                    lingkup: row.lingkup_pekerjaan,
                    cabang: row.cabang,
                    spk_end: row.spk_end,
                    st_date: row.st_date,
                    days_in_range: daysInRange,
                    db_denda: dbDenda,
                    calc_denda: calculated.nilai_denda,
                    match: match,
                    status: match ? '✅' : '❌'
                });
            } catch (error: any) {
                console.log(`❌ Error calculating ${row.nomor_ulok}: ${error.message}`);
            }
        } else {
            safeRecords.push({
                ulok: row.nomor_ulok,
                id_toko: row.id_toko
            });
        }
    }

    console.log("================================================================================");
    console.log("AFFECTED RECORDS (with holidays in grace period)");
    console.log("================================================================================");
    console.log("");

    if (affectedRecords.length === 0) {
        console.log("✅ No records affected by national holidays!");
    } else {
        console.log(`Found ${affectedRecords.length} affected record(s):`);
        console.log("");

        for (const rec of affectedRecords) {
            console.log(`${rec.status} ${rec.ulok} - ${rec.nama_toko} (${rec.lingkup})`);
            console.log(`   Cabang: ${rec.cabang}`);
            console.log(`   SPK End: ${rec.spk_end}, ST: ${rec.st_date}`);
            console.log(`   Days: ${rec.days_in_range.join(', ')}`);
            console.log(`   DB: Rp ${rec.db_denda.toLocaleString('id-ID')}, Calc: Rp ${rec.calc_denda.toLocaleString('id-ID')}`);
            
            if (!rec.match) {
                console.log(`   ⚠️  MISMATCH: Rp ${Math.abs(rec.db_denda - rec.calc_denda).toLocaleString('id-ID')}`);
            }
            console.log("");
        }
    }

    console.log("================================================================================");
    console.log("SUMMARY");
    console.log("================================================================================");
    console.log("");
    console.log(`Total 2026 records: ${result.rows.length}`);
    console.log(`Potentially affected: ${affectedRecords.length}`);
    console.log(`Safe (no holidays): ${safeRecords.length}`);
    console.log("");
    console.log(`✅ Match: ${affectedRecords.filter(r => r.match).length}`);
    console.log(`❌ Mismatch: ${mismatchCount}`);
    console.log("");

    if (mismatchCount === 0) {
        console.log("✅ ALL DATA SAFE - All calculations match database!");
    } else {
        console.log(`⚠️  ${mismatchCount} record(s) need database update!`);
        console.log("");
        console.log("Records need update:");
        affectedRecords
            .filter(r => !r.match)
            .forEach(r => {
                console.log(`  - ${r.ulok} (Toko ${r.id_toko}): DB=${r.db_denda}, Should be=${r.calc_denda}`);
            });
    }

    console.log("");
    console.log("================================================================================");
}

checkAll()
    .then(() => {
        console.log("✅ Check complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
