/**
 * FIND RECORDS WITH DECREASE: Cari records yang denda-nya TURUN karena libur nasional
 * 
 * Target:
 * - Records yang SUDAH punya ST date
 * - Records yang SUDAH punya denda LAMA (old_denda > 0)
 * - Records yang denda BARU lebih kecil karena libur nasional
 */

import { pool } from "../db/pool";
import { calculateDendaFromDates } from "../modules/denda/denda-keterlambatan";
import * as fs from "fs";
import * as path from "path";

type RecordWithDenda = {
    no: number;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    id_toko: number;
    id_opname_final: number | null;
    spk_end: Date | null;
    st_date: Date | null;
    // BEFORE (dari opname_final)
    before_hari_denda: number;
    before_nilai_denda: number;
    // AFTER (re-calculated)
    after_hari_denda: number;
    after_nilai_denda: number;
    // DELTA
    delta_hari_denda: number;
    delta_nilai_denda: number;
    impact_type: string;
};

const parseDate = (value: any): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
};

const formatCurrency = (amount: number): string => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
};

const formatDate = (date: Date | null): string => {
    if (!date) return '-';
    return date.toISOString().split('T')[0];
};

async function findRecordsWithDecrease(): Promise<void> {
    console.log("=".repeat(80));
    console.log("FIND RECORDS WITH DECREASE: Denda Turun Karena Libur Nasional");
    console.log("=".repeat(80));
    console.log("");

    // Query ALL records tahun 2026 yang punya ST date DAN punya old denda > 0
    const result = await pool.query(`
        SELECT 
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.cabang,
            -- SPK End Date (with perpanjangan)
            COALESCE(
                (
                    SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)::date
                    FROM pertambahan_spk pt
                    WHERE pt.id_spk = ps.id
                      AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                ),
                ps.waktu_selesai::date
            ) AS spk_end,
            -- ST Date
            bst.created_at AS st_date,
            -- OLD Denda (dari opname_final)
            of.id AS id_opname_final,
            COALESCE(of.hari_denda, 0) AS old_hari_denda,
            COALESCE(of.nilai_denda, 0) AS old_nilai_denda
        FROM toko t
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        LEFT JOIN opname_final of ON of.id_toko = t.id
        WHERE EXTRACT(YEAR FROM COALESCE(
                (
                    SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)::date
                    FROM pertambahan_spk pt
                    WHERE pt.id_spk = ps.id
                      AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                ),
                ps.waktu_selesai::date
            )) = 2026
          AND bst.created_at IS NOT NULL
          AND of.nilai_denda > 0
          AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
        ORDER BY t.nomor_ulok
    `);

    console.log(`Total records dengan ST date dan old denda > 0: ${result.rows.length}`);
    console.log("");

    const allRecords: RecordWithDenda[] = [];
    const decreaseRecords: RecordWithDenda[] = [];
    const noChangeRecords: RecordWithDenda[] = [];
    const increaseRecords: RecordWithDenda[] = [];

    let recordNumber = 1;

    for (const row of result.rows) {
        const spkEnd = parseDate(row.spk_end);
        const stDate = parseDate(row.st_date);

        const beforeHariDenda = parseInt(row.old_hari_denda) || 0;
        const beforeNilaiDenda = parseInt(row.old_nilai_denda) || 0;

        // Re-calculate dengan logic baru
        let afterHariDenda = 0;
        let afterNilaiDenda = 0;
        let impactType = "UNKNOWN";

        if (spkEnd && stDate) {
            const calculated = calculateDendaFromDates(spkEnd, stDate);
            afterHariDenda = calculated.hari_denda;
            afterNilaiDenda = calculated.nilai_denda;
            
            if (afterNilaiDenda < beforeNilaiDenda) {
                impactType = "DECREASE";
            } else if (afterNilaiDenda > beforeNilaiDenda) {
                impactType = "INCREASE";
            } else {
                impactType = "NO_CHANGE";
            }
        }

        const record: RecordWithDenda = {
            no: recordNumber++,
            nomor_ulok: row.nomor_ulok,
            nama_toko: row.nama_toko,
            cabang: row.cabang,
            id_toko: row.id_toko,
            id_opname_final: row.id_opname_final,
            spk_end: spkEnd,
            st_date: stDate,
            before_hari_denda: beforeHariDenda,
            before_nilai_denda: beforeNilaiDenda,
            after_hari_denda: afterHariDenda,
            after_nilai_denda: afterNilaiDenda,
            delta_hari_denda: afterHariDenda - beforeHariDenda,
            delta_nilai_denda: afterNilaiDenda - beforeNilaiDenda,
            impact_type: impactType
        };

        allRecords.push(record);

        if (impactType === "DECREASE") {
            decreaseRecords.push(record);
        } else if (impactType === "INCREASE") {
            increaseRecords.push(record);
        } else {
            noChangeRecords.push(record);
        }
    }

    // Print summary
    console.log("=".repeat(80));
    console.log("SUMMARY BY IMPACT TYPE");
    console.log("=".repeat(80));
    console.log(`✅ DECREASE: ${decreaseRecords.length} records`);
    console.log(`⚠️  INCREASE: ${increaseRecords.length} records`);
    console.log(`➖ NO_CHANGE: ${noChangeRecords.length} records`);
    console.log(`📊 TOTAL: ${allRecords.length} records`);
    console.log("");

    // Calculate totals
    const totalBeforeDenda = allRecords.reduce((sum, r) => sum + r.before_nilai_denda, 0);
    const totalAfterDenda = allRecords.reduce((sum, r) => sum + r.after_nilai_denda, 0);
    const totalDelta = totalAfterDenda - totalBeforeDenda;

    const decreaseTotalBefore = decreaseRecords.reduce((sum, r) => sum + r.before_nilai_denda, 0);
    const decreaseTotalAfter = decreaseRecords.reduce((sum, r) => sum + r.after_nilai_denda, 0);
    const decreaseTotalDelta = decreaseTotalAfter - decreaseTotalBefore;

    console.log("=".repeat(80));
    console.log("FINANCIAL SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total BEFORE: ${formatCurrency(totalBeforeDenda)}`);
    console.log(`Total AFTER:  ${formatCurrency(totalAfterDenda)}`);
    console.log(`Total DELTA:  ${formatCurrency(totalDelta)}`);
    console.log("");
    console.log(`DECREASE ONLY:`);
    console.log(`  BEFORE: ${formatCurrency(decreaseTotalBefore)}`);
    console.log(`  AFTER:  ${formatCurrency(decreaseTotalAfter)}`);
    console.log(`  DELTA:  ${formatCurrency(decreaseTotalDelta)} (SAVING!)`);
    console.log("");

    // Print DECREASE records detail
    if (decreaseRecords.length > 0) {
        console.log("=".repeat(80));
        console.log("RECORDS WITH DECREASE (Denda Turun)");
        console.log("=".repeat(80));
        
        for (const record of decreaseRecords) {
            console.log(`${record.no}. ${record.nomor_ulok} - ${record.nama_toko}`);
            console.log(`   Cabang: ${record.cabang}`);
            console.log(`   SPK End: ${formatDate(record.spk_end)}`);
            console.log(`   ST Date: ${formatDate(record.st_date)}`);
            console.log(`   BEFORE: ${record.before_hari_denda} hari = ${formatCurrency(record.before_nilai_denda)}`);
            console.log(`   AFTER:  ${record.after_hari_denda} hari = ${formatCurrency(record.after_nilai_denda)}`);
            console.log(`   DELTA:  ${record.delta_hari_denda} hari = ${formatCurrency(record.delta_nilai_denda)} 💰 SAVING!`);
            console.log("");
        }
    } else {
        console.log("⚠️  No records with DECREASE found.");
    }

    // Generate CSV for DECREASE records
    if (decreaseRecords.length > 0) {
        const csvLines: string[] = [
            "No,ULOK,Nama Toko,Cabang,SPK End,ST Date,Before Days,Before Amount,After Days,After Amount,Delta Days,Delta Amount,Saving Amount"
        ];

        for (const r of decreaseRecords) {
            csvLines.push([
                r.no,
                r.nomor_ulok,
                `"${r.nama_toko}"`,
                r.cabang,
                formatDate(r.spk_end),
                formatDate(r.st_date),
                r.before_hari_denda,
                r.before_nilai_denda,
                r.after_hari_denda,
                r.after_nilai_denda,
                r.delta_hari_denda,
                r.delta_nilai_denda,
                Math.abs(r.delta_nilai_denda)
            ].join(","));
        }

        const csvContent = csvLines.join("\n");
        const csvPath = path.join(process.cwd(), "RECORDS-WITH-DECREASE-DENDA.csv");
        fs.writeFileSync(csvPath, csvContent, "utf8");
        console.log(`✅ CSV report saved: ${csvPath}`);
    }

    // Generate summary CSV for ALL records
    const allCsvLines: string[] = [
        "No,ULOK,Nama Toko,Cabang,SPK End,ST Date,Before Days,Before Amount,After Days,After Amount,Delta Days,Delta Amount,Impact Type"
    ];

    for (const r of allRecords) {
        allCsvLines.push([
            r.no,
            r.nomor_ulok,
            `"${r.nama_toko}"`,
            r.cabang,
            formatDate(r.spk_end),
            formatDate(r.st_date),
            r.before_hari_denda,
            r.before_nilai_denda,
            r.after_hari_denda,
            r.after_nilai_denda,
            r.delta_hari_denda,
            r.delta_nilai_denda,
            r.impact_type
        ].join(","));
    }

    const allCsvContent = allCsvLines.join("\n");
    const allCsvPath = path.join(process.cwd(), "ALL-RECORDS-WITH-OLD-DENDA-COMPARISON.csv");
    fs.writeFileSync(allCsvPath, allCsvContent, "utf8");
    console.log(`✅ Full CSV report saved: ${allCsvPath}`);

    console.log("");
    console.log("=".repeat(80));
    console.log("✅ Analysis complete!");
    console.log("=".repeat(80));
}

// Main execution
findRecordsWithDecrease()
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
