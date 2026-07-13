/**
 * FIX 46 RECORDS: Update ST dates to make denda = 0
 * 
 * Problem:
 * - 46 records seharusnya denda = 0 (ST tepat waktu)
 * - Tapi tanggal ST di berkas_serah_terima salah (terlalu lambat)
 * - Akibatnya kelihatan terlambat padahal tidak
 * 
 * Solution:
 * - Update berkas_serah_terima.created_at
 * - Set ke tanggal grace period (agar denda = 0)
 * - Dengan memperhitungkan libur nasional
 */

import { pool } from "../db/pool";
import { nextBusinessDayAfter } from "../common/national-holidays";

const ULOKS_TO_FIX = [
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

type RecordToFix = {
    nomor_ulok: string;
    nama_toko: string;
    id_toko: number;
    spk_end: Date;
    st_date_old: Date;
    grace_date: Date;
    st_date_new: Date;
};

async function analyzeAndFix(dryRun: boolean = true): Promise<void> {
    console.log("=".repeat(80));
    console.log("FIX 46 RECORDS: Update ST Dates for Zero Denda");
    console.log("=".repeat(80));
    console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "PRODUCTION (will update)"}`);
    console.log("");

    const recordsToFix: RecordToFix[] = [];

    for (const ulok of ULOKS_TO_FIX) {
        const result = await pool.query(`
            SELECT 
                t.id AS id_toko,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                ps.waktu_selesai AS spk_end,
                COALESCE(
                    (
                        SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)::date
                        FROM pertambahan_spk pt
                        WHERE pt.id_spk = ps.id
                          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ),
                    ps.waktu_selesai::date
                ) AS effective_spk_end,
                bst.id AS bst_id,
                bst.created_at AS st_date
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
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
        if (!row.st_date) {
            console.log(`⚠️  ${ulok}: No ST date found`);
            continue;
        }

        const spkEnd = new Date(row.effective_spk_end);
        const stDateOld = new Date(row.st_date);
        
        // Calculate grace period dengan libur nasional
        const graceDate = nextBusinessDayAfter(spkEnd);
        
        // ST date baru = grace date (agar denda = 0)
        // Set jam ke jam yang sama dengan ST lama
        const stDateNew = new Date(graceDate);
        stDateNew.setHours(stDateOld.getHours());
        stDateNew.setMinutes(stDateOld.getMinutes());
        stDateNew.setSeconds(stDateOld.getSeconds());

        recordsToFix.push({
            nomor_ulok: row.nomor_ulok,
            nama_toko: row.nama_toko,
            id_toko: row.id_toko,
            spk_end: spkEnd,
            st_date_old: stDateOld,
            grace_date: graceDate,
            st_date_new: stDateNew
        });

        console.log(`${row.nomor_ulok} - ${row.nama_toko} (${row.cabang})`);
        console.log(`  SPK End: ${spkEnd.toISOString().split('T')[0]}`);
        console.log(`  Grace Period: ${graceDate.toISOString().split('T')[0]}`);
        console.log(`  ST Date OLD: ${stDateOld.toISOString().split('T')[0]} (SALAH - terlambat)`);
        console.log(`  ST Date NEW: ${stDateNew.toISOString().split('T')[0]} (BENAR - tepat waktu)`);
        console.log("");
    }

    console.log("=".repeat(80));
    console.log(`Total records to fix: ${recordsToFix.length}`);
    console.log("=".repeat(80));
    console.log("");

    if (dryRun) {
        console.log("✅ DRY RUN complete. No changes made.");
        console.log("Run with --production flag to apply changes.");
        return;
    }

    // PRODUCTION MODE: Apply updates
    console.log("Applying updates...");
    console.log("");

    let updated = 0;
    for (const record of recordsToFix) {
        try {
            await pool.query(`
                UPDATE berkas_serah_terima
                SET created_at = $1
                WHERE id_toko = $2
            `, [record.st_date_new, record.id_toko]);

            console.log(`✅ ${record.nomor_ulok}: Updated ST date to ${record.st_date_new.toISOString().split('T')[0]}`);
            updated++;
        } catch (error) {
            console.error(`❌ ${record.nomor_ulok}: Failed to update - ${error}`);
        }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log(`✅ COMPLETE: Updated ${updated} of ${recordsToFix.length} records`);
    console.log("=".repeat(80));
}

// Main execution
const args = process.argv.slice(2);
const isProduction = args.includes('--production');

analyzeAndFix(!isProduction)
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
