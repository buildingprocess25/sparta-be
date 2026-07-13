/**
 * REFRESH OPNAME FINAL: Re-calculate denda untuk 42 records yang sudah diperbaiki ST date-nya
 * 
 * Problem:
 * - 42 records ST date sudah diperbaiki di berkas_serah_terima
 * - Tapi opname_final masih punya denda LAMA (sebelum libur nasional)
 * - Perlu re-calculate dan update opname_final
 * 
 * Solution:
 * - Query current denda dari opname_final (BEFORE)
 * - Calculate ulang pakai logic baru dengan libur nasional (AFTER)
 * - Update opname_final dengan nilai baru
 * - Generate CSV comparison report
 */

import { pool } from "../db/pool";
import { calculateDendaFromDates } from "../modules/denda/denda-keterlambatan";
import * as fs from "fs";
import * as path from "path";

const ULOKS_TO_REFRESH = [
    'Z001-2601-6565', 'XZ01-2512-0002', '2VZ1-2603-R353-R', '2VZ1-2603-R531-R',
    '2VZ1-2603-R702-R', '2VZ1-2603-R614-R', '2JZ1-2512-0004', 'LZ01-2602-0004',
    'Z001-2121-0001', '2DZ1-2601-0003-R', '2DZ1-2601-0002', 'UZ01-2602-0015',
    'UZ01-2601-0005', '1JZ1-2602-0001', 'WZ01-2602-0026', '2PZ1-2508-0007',
    '2AZ1-2602-0001', '1DZ1-2601-0001-R', '1YZ1-2604-0001', 'WZ01-2602-0010',
    '1JZ1-2604-0001', 'UZ01-2602-0010', 'UZ01-2602-0009', '2SZ1-2603-0001-R',
    'RZ01-2604-0004', '2VZ1-2604-0001-R', '2VZ1-2603-0001', '1MZ1-2604-1M4P-R',
    'YZ01-2604-0004', 'CZ01-2603-0001', '2SZ1-2603-0002', '2MZ1-2602-0002',
    'CZ01-2604-0002', '1JZ1-2605-1J3U-R', 'CZ01-2603-0003', '2SZ1-2508-0009',
    'UZ01-2602-0023', 'IZ01-2603-0010', 'CZ01-2603-0002', 'HZ01-2604-0001',
    'UZ01-2603-0021', 'UZ01-2605-M719-R'
];

type ComparisonRecord = {
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
    status: string;
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

async function analyzeAndRefresh(dryRun: boolean = true): Promise<void> {
    console.log("=".repeat(80));
    console.log("REFRESH OPNAME FINAL: Re-calculate Denda for 42 Records");
    console.log("=".repeat(80));
    console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "PRODUCTION (will update)"}`);
    console.log("");

    const comparisons: ComparisonRecord[] = [];
    let recordNumber = 1;

    for (const ulok of ULOKS_TO_REFRESH) {
        // Query data lengkap: toko, SPK, ST, opname_final
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
                -- ST Date (dari berkas_serah_terima yang sudah diperbaiki)
                bst.created_at AS st_date,
                -- OLD Denda (dari opname_final)
                of.id AS id_opname_final,
                COALESCE(of.hari_denda, 0) AS old_hari_denda,
                COALESCE(of.nilai_denda, 0) AS old_nilai_denda
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            LEFT JOIN opname_final of ON of.id_toko = t.id
            WHERE t.nomor_ulok = $1
              AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
            ORDER BY ps.id DESC
            LIMIT 1
        `, [ulok]);

        if (result.rows.length === 0) {
            console.log(`⚠️  ${ulok}: Not found in database`);
            continue;
        }

        const row = result.rows[0];
        
        // Parse dates
        const spkEnd = parseDate(row.spk_end);
        const stDate = parseDate(row.st_date);

        // BEFORE (dari opname_final)
        const beforeHariDenda = parseInt(row.old_hari_denda) || 0;
        const beforeNilaiDenda = parseInt(row.old_nilai_denda) || 0;

        // AFTER (re-calculate dengan logic baru)
        let afterHariDenda = 0;
        let afterNilaiDenda = 0;
        let status = "UNKNOWN";

        if (!stDate) {
            status = "NO_ST_DATE";
        } else if (!spkEnd) {
            status = "NO_SPK_END";
        } else {
            const calculated = calculateDendaFromDates(spkEnd, stDate);
            afterHariDenda = calculated.hari_denda;
            afterNilaiDenda = calculated.nilai_denda;
            
            if (beforeNilaiDenda === afterNilaiDenda && beforeHariDenda === afterHariDenda) {
                status = "NO_CHANGE";
            } else if (afterNilaiDenda < beforeNilaiDenda) {
                status = "DECREASE";
            } else if (afterNilaiDenda > beforeNilaiDenda) {
                status = "INCREASE";
            } else {
                status = "CHANGE";
            }
        }

        const comparison: ComparisonRecord = {
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
            status
        };

        comparisons.push(comparison);

        // Print to console
        console.log(`${comparison.no}. ${row.nomor_ulok} - ${row.nama_toko}`);
        console.log(`   Cabang: ${row.cabang}`);
        console.log(`   SPK End: ${formatDate(spkEnd)}`);
        console.log(`   ST Date: ${formatDate(stDate)}`);
        console.log(`   BEFORE: ${beforeHariDenda} hari = ${formatCurrency(beforeNilaiDenda)}`);
        console.log(`   AFTER:  ${afterHariDenda} hari = ${formatCurrency(afterNilaiDenda)}`);
        console.log(`   DELTA:  ${comparison.delta_hari_denda} hari = ${formatCurrency(comparison.delta_nilai_denda)}`);
        console.log(`   Status: ${status}`);
        console.log("");
    }

    // Generate summary
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    
    const totalRecords = comparisons.length;
    const noChange = comparisons.filter(c => c.status === "NO_CHANGE").length;
    const decrease = comparisons.filter(c => c.status === "DECREASE").length;
    const increase = comparisons.filter(c => c.status === "INCREASE").length;
    const noStDate = comparisons.filter(c => c.status === "NO_ST_DATE").length;
    const noSpkEnd = comparisons.filter(c => c.status === "NO_SPK_END").length;

    const totalBeforeAmount = comparisons.reduce((sum, c) => sum + c.before_nilai_denda, 0);
    const totalAfterAmount = comparisons.reduce((sum, c) => sum + c.after_nilai_denda, 0);
    const totalDelta = totalAfterAmount - totalBeforeAmount;

    console.log(`Total Records: ${totalRecords}`);
    console.log(`- No Change: ${noChange}`);
    console.log(`- Decrease: ${decrease}`);
    console.log(`- Increase: ${increase}`);
    console.log(`- No ST Date: ${noStDate}`);
    console.log(`- No SPK End: ${noSpkEnd}`);
    console.log("");
    console.log(`Total BEFORE: ${formatCurrency(totalBeforeAmount)}`);
    console.log(`Total AFTER:  ${formatCurrency(totalAfterAmount)}`);
    console.log(`Total DELTA:  ${formatCurrency(totalDelta)}`);
    console.log("=".repeat(80));
    console.log("");

    // Generate CSV report
    const csvLines: string[] = [
        "No,ULOK,Nama Toko,Cabang,SPK End,ST Date,Before Days,Before Amount,After Days,After Amount,Delta Days,Delta Amount,Status"
    ];

    for (const c of comparisons) {
        csvLines.push([
            c.no,
            c.nomor_ulok,
            `"${c.nama_toko}"`,
            c.cabang,
            formatDate(c.spk_end),
            formatDate(c.st_date),
            c.before_hari_denda,
            c.before_nilai_denda,
            c.after_hari_denda,
            c.after_nilai_denda,
            c.delta_hari_denda,
            c.delta_nilai_denda,
            c.status
        ].join(","));
    }

    const csvContent = csvLines.join("\n");
    const csvPath = path.join(process.cwd(), "REFRESH-OPNAME-FINAL-COMPARISON.csv");
    fs.writeFileSync(csvPath, csvContent, "utf8");
    console.log(`✅ CSV report saved: ${csvPath}`);
    console.log("");

    if (dryRun) {
        console.log("✅ DRY RUN complete. No changes made.");
        console.log("Run with --production flag to apply updates.");
        return;
    }

    // PRODUCTION MODE: Apply updates to opname_final
    console.log("=".repeat(80));
    console.log("APPLYING UPDATES TO opname_final");
    console.log("=".repeat(80));
    console.log("");

    let updated = 0;
    let skipped = 0;

    for (const c of comparisons) {
        if (c.status === "NO_ST_DATE" || c.status === "NO_SPK_END" || c.status === "NO_CHANGE") {
            console.log(`⏭️  ${c.nomor_ulok}: Skipped (${c.status})`);
            skipped++;
            continue;
        }

        if (!c.id_opname_final) {
            console.log(`⚠️  ${c.nomor_ulok}: No opname_final record found, skipping`);
            skipped++;
            continue;
        }

        try {
            await pool.query(`
                UPDATE opname_final
                SET 
                    hari_denda = $1,
                    nilai_denda = $2
                WHERE id = $3
            `, [c.after_hari_denda, c.after_nilai_denda, c.id_opname_final]);

            console.log(`✅ ${c.nomor_ulok}: Updated ${c.before_nilai_denda} → ${c.after_nilai_denda}`);
            updated++;
        } catch (error) {
            console.error(`❌ ${c.nomor_ulok}: Failed to update - ${error}`);
        }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log(`✅ COMPLETE: Updated ${updated} records, Skipped ${skipped} records`);
    console.log("=".repeat(80));
}

// Main execution
const args = process.argv.slice(2);
const isProduction = args.includes('--production');

analyzeAndRefresh(!isProduction)
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
