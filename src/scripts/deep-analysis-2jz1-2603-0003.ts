/**
 * DEEP ANALYSIS: Kenapa 2JZ1-2603-0003 masih 1 hari terlambat?
 * 
 * Trace complete flow dari database → calculation → API response
 */

import { pool } from "../db/pool";
import { calculateDendaFromDates } from "../modules/denda/denda-keterlambatan";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";
import { 
    nextBusinessDayAfter, 
    isNationalHoliday, 
    isWeekend,
    toIsoDateString,
    NATIONAL_HOLIDAYS_2026 
} from "../common/national-holidays";

async function deepAnalysis() {
    console.log("=".repeat(80));
    console.log("DEEP ANALYSIS: ULOK 2JZ1-2603-0003 - GUNUNG JAYA");
    console.log("=".repeat(80));
    console.log("");

    const ulok = "2JZ1-2603-0003";

    // ========================================================================
    // STEP 1: RAW DATABASE VALUES
    // ========================================================================
    console.log("STEP 1: RAW DATABASE VALUES");
    console.log("-".repeat(80));

    const dbResult = await pool.query(`
        SELECT 
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.cabang,
            ps.waktu_selesai AS spk_end_raw,
            ps.waktu_selesai::date AS spk_end_date,
            COALESCE(
                (
                    SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)::date
                    FROM pertambahan_spk pt
                    WHERE pt.id_spk = ps.id
                      AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                ),
                ps.waktu_selesai::date
            ) AS spk_end_effective,
            bst.created_at AS st_date_raw,
            bst.created_at::date AS st_date,
            of.hari_denda AS opname_hari_denda,
            of.nilai_denda AS opname_nilai_denda,
            of.tanggal_akhir_spk_denda,
            of.tanggal_serah_terima_denda
        FROM toko t
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        LEFT JOIN opname_final of ON of.id_toko = t.id
        WHERE t.nomor_ulok = $1
          AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
        ORDER BY ps.id DESC
        LIMIT 1
    `, [ulok]);

    if (dbResult.rows.length === 0) {
        console.log("❌ ULOK not found!");
        return;
    }

    const row = dbResult.rows[0];
    console.log(`ULOK: ${row.nomor_ulok}`);
    console.log(`Toko: ${row.nama_toko}`);
    console.log(`Cabang: ${row.cabang}`);
    console.log(`ID Toko: ${row.id_toko}`);
    console.log("");
    console.log(`SPK End (raw): ${row.spk_end_raw}`);
    console.log(`SPK End (date): ${row.spk_end_date}`);
    console.log(`SPK End (effective): ${row.spk_end_effective}`);
    console.log("");
    console.log(`ST Date (raw): ${row.st_date_raw}`);
    console.log(`ST Date (date): ${row.st_date}`);
    console.log("");
    console.log(`Opname Final:`);
    console.log(`  - Hari Denda: ${row.opname_hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${parseInt(row.opname_nilai_denda || 0).toLocaleString('id-ID')}`);
    console.log(`  - Tanggal Akhir SPK: ${row.tanggal_akhir_spk_denda}`);
    console.log(`  - Tanggal ST: ${row.tanggal_serah_terima_denda}`);
    console.log("");

    // ========================================================================
    // STEP 2: CHECK NATIONAL HOLIDAYS
    // ========================================================================
    console.log("STEP 2: CHECK NATIONAL HOLIDAYS");
    console.log("-".repeat(80));

    const spkEndDate = new Date(row.spk_end_effective);
    const stDateObj = new Date(row.st_date);

    console.log(`SPK End: ${toIsoDateString(spkEndDate)} (${spkEndDate.toLocaleDateString('id-ID', { weekday: 'long' })})`);
    console.log(`ST Date: ${toIsoDateString(stDateObj)} (${stDateObj.toLocaleDateString('id-ID', { weekday: 'long' })})`);
    console.log("");

    // Check each day between SPK end and ST
    console.log("Days between SPK End and ST:");
    let currentCheck = new Date(spkEndDate);
    while (currentCheck <= stDateObj) {
        const dateStr = toIsoDateString(currentCheck);
        const dayName = currentCheck.toLocaleDateString('id-ID', { weekday: 'long' });
        const isWeekendDay = isWeekend(currentCheck);
        const isHoliday = isNationalHoliday(currentCheck);
        const holiday = NATIONAL_HOLIDAYS_2026.find(h => h.date === dateStr);
        
        let label = "";
        if (isWeekendDay) label = " ← WEEKEND";
        if (isHoliday) label = ` ← LIBUR: ${holiday?.description}`;
        
        console.log(`  ${dateStr} (${dayName})${label}`);
        
        currentCheck.setDate(currentCheck.getDate() + 1);
    }
    console.log("");

    // ========================================================================
    // STEP 3: CALCULATE GRACE PERIOD
    // ========================================================================
    console.log("STEP 3: CALCULATE GRACE PERIOD");
    console.log("-".repeat(80));

    const gracePeriod = nextBusinessDayAfter(spkEndDate);
    console.log(`SPK End: ${toIsoDateString(spkEndDate)}`);
    console.log(`Grace Period (next business day): ${toIsoDateString(gracePeriod)}`);
    console.log("");

    // Show what was skipped
    let checkDate = new Date(spkEndDate);
    checkDate.setDate(checkDate.getDate() + 1);
    const skipped: string[] = [];
    while (checkDate < gracePeriod) {
        const dateStr = toIsoDateString(checkDate);
        const dayName = checkDate.toLocaleDateString('id-ID', { weekday: 'short' });
        if (isWeekend(checkDate)) {
            skipped.push(`${dateStr} (${dayName}) - Weekend`);
        } else if (isNationalHoliday(checkDate)) {
            const holiday = NATIONAL_HOLIDAYS_2026.find(h => h.date === dateStr);
            skipped.push(`${dateStr} (${dayName}) - ${holiday?.description}`);
        }
        checkDate.setDate(checkDate.getDate() + 1);
    }
    
    if (skipped.length > 0) {
        console.log("Days skipped:");
        skipped.forEach(s => console.log(`  - ${s}`));
    } else {
        console.log("No days skipped (SPK end on workday)");
    }
    console.log("");

    // ========================================================================
    // STEP 4: CALCULATE DENDA (Method 1: Direct)
    // ========================================================================
    console.log("STEP 4: CALCULATE DENDA (Direct Method)");
    console.log("-".repeat(80));

    const calculated1 = calculateDendaFromDates(spkEndDate, stDateObj);
    console.log(`Input:`);
    console.log(`  - SPK End: ${toIsoDateString(spkEndDate)}`);
    console.log(`  - ST Date: ${toIsoDateString(stDateObj)}`);
    console.log("");
    console.log(`Output:`);
    console.log(`  - Hari Denda: ${calculated1.hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${calculated1.nilai_denda.toLocaleString('id-ID')}`);
    console.log(`  - Grace Date: ${calculated1.tanggal_akhir_spk}`);
    console.log("");

    // ========================================================================
    // STEP 5: CALCULATE DENDA (Method 2: By Toko ID)
    // ========================================================================
    console.log("STEP 5: CALCULATE DENDA (By Toko ID - used by API)");
    console.log("-".repeat(80));

    const calculated2 = await calculateDendaByTokoId(row.id_toko);
    console.log(`Input:`);
    console.log(`  - Toko ID: ${row.id_toko}`);
    console.log("");
    console.log(`Output:`);
    console.log(`  - Hari Denda: ${calculated2.hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${calculated2.nilai_denda.toLocaleString('id-ID')}`);
    console.log(`  - Tanggal Akhir SPK: ${calculated2.tanggal_akhir_spk}`);
    console.log(`  - Tanggal ST: ${calculated2.tanggal_serah_terima}`);
    console.log("");

    // ========================================================================
    // STEP 6: COMPARISON
    // ========================================================================
    console.log("STEP 6: COMPARISON");
    console.log("-".repeat(80));

    console.log(`Database (opname_final):`);
    console.log(`  - Hari Denda: ${row.opname_hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${parseInt(row.opname_nilai_denda || 0).toLocaleString('id-ID')}`);
    console.log("");

    console.log(`Calculated (Direct):`);
    console.log(`  - Hari Denda: ${calculated1.hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${calculated1.nilai_denda.toLocaleString('id-ID')}`);
    console.log("");

    console.log(`Calculated (By Toko ID):`);
    console.log(`  - Hari Denda: ${calculated2.hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${calculated2.nilai_denda.toLocaleString('id-ID')}`);
    console.log("");

    // ========================================================================
    // STEP 7: UI WOULD SHOW (simulate API response)
    // ========================================================================
    console.log("STEP 7: WHAT UI WOULD SHOW");
    console.log("-".repeat(80));

    // Simulate serah-terima list logic
    let displayHariDenda = row.opname_hari_denda;
    let displayNilaiDenda = row.opname_nilai_denda;

    if (displayHariDenda === null || displayHariDenda === undefined) {
        // If no opname_final, use calculated
        displayHariDenda = calculated2.hari_denda;
        displayNilaiDenda = String(calculated2.nilai_denda);
        console.log("Source: Calculated (no opname_final)");
    } else {
        console.log("Source: opname_final table");
    }

    console.log(`UI Display:`);
    console.log(`  - Hari Denda: ${displayHariDenda}`);
    console.log(`  - Nilai Denda: Rp ${parseInt(displayNilaiDenda || 0).toLocaleString('id-ID')}`);
    console.log("");

    // ========================================================================
    // STEP 8: DIAGNOSIS
    // ========================================================================
    console.log("STEP 8: DIAGNOSIS");
    console.log("=".repeat(80));

    if (parseInt(displayNilaiDenda || 0) !== calculated2.nilai_denda) {
        console.log("❌ MISMATCH DETECTED!");
        console.log("");
        console.log("Possible Causes:");
        console.log("1. opname_final table has OLD value (need refresh)");
        console.log("2. Backend not restarted after build");
        console.log("3. API using old dist/ files");
        console.log("4. Cache issue");
        console.log("");
        console.log("Recommended Actions:");
        console.log("1. Refresh opname_final table for this ULOK");
        console.log("2. Restart backend");
        console.log("3. Clear browser cache");
    } else {
        console.log("✅ ALL VALUES MATCH!");
        console.log("");
        console.log("If UI still shows wrong value:");
        console.log("1. Hard refresh browser (Ctrl + Shift + R)");
        console.log("2. Check if backend actually restarted");
        console.log("3. Check browser console for errors");
    }

    console.log("");
    console.log("=".repeat(80));
}

deepAnalysis()
    .then(() => {
        console.log("✅ Deep analysis complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
