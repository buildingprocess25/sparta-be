/**
 * IMPACT ANALYSIS: National Holidays 2026
 * 
 * Script untuk analisis dampak implementasi libur nasional terhadap:
 * 1. Jumlah ULOK yang terpengaruh
 * 2. Perubahan denda (naik/turun)
 * 3. Financial impact
 * 4. Breakdown per cabang
 */

import { pool } from "../db/pool";
import { calculateGanttSchedule } from "../modules/gantt/gantt-date-calculator";
import { calculateDendaFromDates } from "../modules/denda/denda-keterlambatan";

type ImpactAnalysisRow = {
    id_spk: number;
    id_toko: number;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    lingkup_pekerjaan: string;
    waktu_mulai: string;
    waktu_selesai: string;
    durasi: number;
    effective_waktu_selesai: string;
    has_st: boolean;
    st_date: string | null;
    old_hari_denda: number | null;
    old_nilai_denda: string | null;
};

type ImpactResult = {
    ulok: string;
    nama_toko: string;
    cabang: string;
    spk_end: string;
    st_date: string | null;
    old_denda_days: number;
    old_denda_amount: number;
    new_denda_days: number;
    new_denda_amount: number;
    impact_days: number;
    impact_amount: number;
    impact_type: "REDUCTION" | "NO_CHANGE" | "INCREASE";
    skipped_days: number;
    skipped_weekends: number;
    skipped_holidays: number;
    explanation: string;
};

async function fetchAllSpkData(): Promise<ImpactAnalysisRow[]> {
    const result = await pool.query<ImpactAnalysisRow>(`
        WITH spk_with_extension AS (
            SELECT 
                ps.id AS id_spk,
                ps.id_toko,
                ps.nomor_ulok,
                ps.lingkup_pekerjaan,
                ps.waktu_mulai,
                ps.waktu_selesai,
                ps.durasi,
                COALESCE(
                    (
                        SELECT MAX(pt2.tanggal_spk_akhir_setelah_perpanjangan)::date
                        FROM pertambahan_spk pt2
                        WHERE pt2.id_spk = ps.id
                          AND UPPER(TRIM(COALESCE(pt2.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ),
                    ps.waktu_selesai::date
                ) AS effective_waktu_selesai
            FROM pengajuan_spk ps
            WHERE UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
              AND ps.waktu_selesai >= '2026-01-01'::date
        )
        SELECT 
            s.*,
            t.nama_toko,
            t.cabang,
            EXISTS(
                SELECT 1 
                FROM berkas_serah_terima bst 
                WHERE bst.id_toko = s.id_toko
            ) AS has_st,
            bst.created_at::date AS st_date,
            ofn.hari_denda AS old_hari_denda,
            ofn.nilai_denda AS old_nilai_denda
        FROM spk_with_extension s
        JOIN toko t ON t.id = s.id_toko
        LEFT JOIN opname_final ofn ON ofn.id_toko = s.id_toko
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = s.id_toko
        ORDER BY s.effective_waktu_selesai ASC, s.id_spk ASC
    `);

    return result.rows;
}

function calculateNewDenda(spkEnd: string, stDate: string | null): {
    days: number;
    amount: number;
} {
    if (!stDate) {
        return { days: 0, amount: 0 };
    }

    const result = calculateDendaFromDates(
        new Date(spkEnd),
        new Date(stDate)
    );

    return {
        days: result.hari_denda,
        amount: result.nilai_denda
    };
}

async function analyzeImpact(): Promise<void> {
    console.log("=".repeat(100));
    console.log("IMPACT ANALYSIS: National Holidays 2026 Implementation");
    console.log("=".repeat(100));
    console.log("");

    const allSpk = await fetchAllSpkData();
    console.log(`Total SPK (2026): ${allSpk.length} records`);
    console.log("");

    const results: ImpactResult[] = [];

    for (const spk of allSpk) {
        const schedule = calculateGanttSchedule(spk.waktu_mulai, spk.durasi);
        
        // Old denda (from database)
        const oldDendaDays = spk.old_hari_denda ?? 0;
        const oldDendaAmount = Number(spk.old_nilai_denda ?? 0);

        // New denda calculation
        const newDenda = spk.has_st 
            ? calculateNewDenda(spk.effective_waktu_selesai, spk.st_date)
            : { days: 0, amount: 0 };

        const impactDays = newDenda.days - oldDendaDays;
        const impactAmount = newDenda.amount - oldDendaAmount;

        let impactType: "REDUCTION" | "NO_CHANGE" | "INCREASE";
        if (impactAmount < 0) impactType = "REDUCTION";
        else if (impactAmount > 0) impactType = "INCREASE";
        else impactType = "NO_CHANGE";

        results.push({
            ulok: spk.nomor_ulok,
            nama_toko: spk.nama_toko,
            cabang: spk.cabang,
            spk_end: spk.effective_waktu_selesai,
            st_date: spk.st_date,
            old_denda_days: oldDendaDays,
            old_denda_amount: oldDendaAmount,
            new_denda_days: newDenda.days,
            new_denda_amount: newDenda.amount,
            impact_days: impactDays,
            impact_amount: impactAmount,
            impact_type: impactType,
            skipped_days: schedule.skipped_days,
            skipped_weekends: schedule.skipped_weekends,
            skipped_holidays: schedule.skipped_holidays,
            explanation: schedule.st_label
        });
    }

    // =====================================================================
    // SUMMARY STATISTICS
    // =====================================================================

    console.log("=".repeat(100));
    console.log("📊 SUMMARY STATISTICS");
    console.log("=".repeat(100));
    console.log("");

    const totalRecords = results.length;
    const withSt = results.filter(r => r.st_date !== null);
    const withoutSt = results.filter(r => r.st_date === null);
    
    console.log(`Total Records Analyzed: ${totalRecords}`);
    console.log(`  - Sudah ST: ${withSt.length} records`);
    console.log(`  - Belum ST: ${withoutSt.length} records`);
    console.log("");

    // Impact breakdown
    const reduction = results.filter(r => r.impact_type === "REDUCTION");
    const noChange = results.filter(r => r.impact_type === "NO_CHANGE");
    const increase = results.filter(r => r.impact_type === "INCREASE");

    console.log("Impact Breakdown:");
    console.log(`  ✅ REDUCTION (denda berkurang): ${reduction.length} records`);
    console.log(`  ➖ NO CHANGE (denda tetap): ${noChange.length} records`);
    console.log(`  ⚠️  INCREASE (denda bertambah): ${increase.length} records`);
    console.log("");

    // Financial impact
    const totalOldDenda = results.reduce((sum, r) => sum + r.old_denda_amount, 0);
    const totalNewDenda = results.reduce((sum, r) => sum + r.new_denda_amount, 0);
    const totalImpact = totalNewDenda - totalOldDenda;

    console.log("💰 Financial Impact:");
    console.log(`  Old Total Denda: Rp ${totalOldDenda.toLocaleString("id-ID")}`);
    console.log(`  New Total Denda: Rp ${totalNewDenda.toLocaleString("id-ID")}`);
    console.log(`  Impact: Rp ${totalImpact.toLocaleString("id-ID")} (${totalImpact < 0 ? "SAVING" : "INCREASE"})`);
    console.log("");

    // Skip pattern analysis
    const withHolidays = results.filter(r => r.skipped_holidays > 0);
    console.log(`Records dengan Libur Nasional: ${withHolidays.length}`);
    console.log("");

    // =====================================================================
    // DETAILED REDUCTION LIST
    // =====================================================================

    if (reduction.length > 0) {
        console.log("=".repeat(100));
        console.log("✅ RECORDS WITH DENDA REDUCTION (Top 20)");
        console.log("=".repeat(100));
        console.log("");

        const topReductions = reduction
            .sort((a, b) => a.impact_amount - b.impact_amount)
            .slice(0, 20);

        topReductions.forEach((r, idx) => {
            console.log(`${idx + 1}. ${r.ulok} - ${r.nama_toko}`);
            console.log(`   Cabang: ${r.cabang}`);
            console.log(`   SPK End: ${r.spk_end}`);
            console.log(`   ST Date: ${r.st_date}`);
            console.log(`   Old Denda: ${r.old_denda_days} hari = Rp ${r.old_denda_amount.toLocaleString("id-ID")}`);
            console.log(`   New Denda: ${r.new_denda_days} hari = Rp ${r.new_denda_amount.toLocaleString("id-ID")}`);
            console.log(`   💰 SAVING: ${Math.abs(r.impact_days)} hari = Rp ${Math.abs(r.impact_amount).toLocaleString("id-ID")}`);
            console.log(`   Skip: ${r.explanation}`);
            console.log("");
        });
    }

    // =====================================================================
    // BREAKDOWN PER CABANG
    // =====================================================================

    console.log("=".repeat(100));
    console.log("📍 BREAKDOWN PER CABANG");
    console.log("=".repeat(100));
    console.log("");

    const byCabang = new Map<string, {
        count: number;
        reduction: number;
        noChange: number;
        increase: number;
        totalOldDenda: number;
        totalNewDenda: number;
        totalImpact: number;
    }>();

    results.forEach(r => {
        const key = r.cabang || "Unknown";
        const existing = byCabang.get(key) || {
            count: 0,
            reduction: 0,
            noChange: 0,
            increase: 0,
            totalOldDenda: 0,
            totalNewDenda: 0,
            totalImpact: 0
        };

        existing.count++;
        if (r.impact_type === "REDUCTION") existing.reduction++;
        if (r.impact_type === "NO_CHANGE") existing.noChange++;
        if (r.impact_type === "INCREASE") existing.increase++;
        existing.totalOldDenda += r.old_denda_amount;
        existing.totalNewDenda += r.new_denda_amount;
        existing.totalImpact += r.impact_amount;

        byCabang.set(key, existing);
    });

    // Sort by total impact (most savings first)
    const cabangSorted = Array.from(byCabang.entries())
        .sort(([, a], [, b]) => a.totalImpact - b.totalImpact);

    cabangSorted.forEach(([cabang, data]) => {
        console.log(`${cabang}:`);
        console.log(`  Total: ${data.count} records`);
        console.log(`  Reduction: ${data.reduction}, No Change: ${data.noChange}, Increase: ${data.increase}`);
        console.log(`  Old Denda: Rp ${data.totalOldDenda.toLocaleString("id-ID")}`);
        console.log(`  New Denda: Rp ${data.totalNewDenda.toLocaleString("id-ID")}`);
        console.log(`  Impact: Rp ${data.totalImpact.toLocaleString("id-ID")} (${data.totalImpact < 0 ? "SAVING ✅" : "INCREASE ⚠️"})`);
        console.log("");
    });

    // =====================================================================
    // RECORDS WITH NATIONAL HOLIDAYS
    // =====================================================================

    if (withHolidays.length > 0) {
        console.log("=".repeat(100));
        console.log("🎉 RECORDS TERPENGARUH LIBUR NASIONAL (Top 20)");
        console.log("=".repeat(100));
        console.log("");

        const topHolidays = withHolidays
            .sort((a, b) => b.skipped_holidays - a.skipped_holidays)
            .slice(0, 20);

        topHolidays.forEach((r, idx) => {
            console.log(`${idx + 1}. ${r.ulok} - ${r.nama_toko}`);
            console.log(`   SPK End: ${r.spk_end}`);
            console.log(`   ST Date: ${r.st_date || "Belum ST"}`);
            console.log(`   Skip: ${r.skipped_holidays} libur nasional, ${r.skipped_weekends} weekend`);
            console.log(`   Label: ${r.explanation}`);
            console.log(`   Denda Impact: ${r.old_denda_days} → ${r.new_denda_days} hari (${r.impact_days > 0 ? "+" : ""}${r.impact_days})`);
            console.log("");
        });
    }

    // =====================================================================
    // EXPORT TO CSV
    // =====================================================================

    console.log("=".repeat(100));
    console.log("💾 EXPORTING RESULTS TO CSV");
    console.log("=".repeat(100));
    console.log("");

    const csvHeader = [
        "ULOK",
        "Nama Toko",
        "Cabang",
        "SPK End",
        "ST Date",
        "Has ST",
        "Old Denda Days",
        "Old Denda Amount",
        "New Denda Days",
        "New Denda Amount",
        "Impact Days",
        "Impact Amount",
        "Impact Type",
        "Skipped Days",
        "Skipped Weekends",
        "Skipped Holidays",
        "Explanation"
    ].join(",");

    const csvRows = results.map(r => [
        r.ulok,
        `"${r.nama_toko}"`,
        r.cabang,
        r.spk_end,
        r.st_date || "",
        r.st_date ? "Yes" : "No",
        r.old_denda_days,
        r.old_denda_amount,
        r.new_denda_days,
        r.new_denda_amount,
        r.impact_days,
        r.impact_amount,
        r.impact_type,
        r.skipped_days,
        r.skipped_weekends,
        r.skipped_holidays,
        `"${r.explanation}"`
    ].join(","));

    const csv = [csvHeader, ...csvRows].join("\n");
    
    const fs = require("fs");
    const outputPath = "holiday_impact_analysis_2026.csv";
    fs.writeFileSync(outputPath, csv);
    
    console.log(`✅ Results exported to: ${outputPath}`);
    console.log("");

    console.log("=".repeat(100));
    console.log("ANALYSIS COMPLETE");
    console.log("=".repeat(100));
}

// Main execution
analyzeImpact()
    .then(() => {
        console.log("\n✅ Analysis completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Analysis failed:", error);
        process.exit(1);
    });
