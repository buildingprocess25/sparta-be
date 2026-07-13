/**
 * UPDATE 5 RECORDS: Update opname_final untuk records yang denda-nya TURUN
 * 
 * Records:
 * 1. 1JZ1-2605-1J20-R - SEGARAN: 1 hari → 0 hari (Rp 1M → Rp 0)
 * 2. 1JZ1-2605-1JK5-R - RAYA KERTASARI: 2 hari → 1 hari (Rp 2M → Rp 1M)
 * 3. 2JZ1-2603-0003 - GUNUNG JAYA: 1 hari → 0 hari (Rp 1M → Rp 0)
 * 4. UZ01-2603-0011 - KPG OESAPA SELATAN: 3 hari → 0 hari (Rp 3M → Rp 0)
 * 5. WZ01-2604-0009 - SIGURA GURA: 5 hari → 4 hari (Rp 5M → Rp 4M)
 * 
 * Total Saving: Rp 7.000.000
 */

import { pool } from "../db/pool";
import { calculateDendaFromDates } from "../modules/denda/denda-keterlambatan";

const ULOKS_TO_UPDATE = [
    '1JZ1-2605-1J20-R',
    '1JZ1-2605-1JK5-R',
    '2JZ1-2603-0003',
    'UZ01-2603-0011',
    'WZ01-2604-0009'
];

type UpdateRecord = {
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    id_toko: number;
    id_opname_final: number;
    spk_end: Date;
    st_date: Date;
    before_hari_denda: number;
    before_nilai_denda: number;
    after_hari_denda: number;
    after_nilai_denda: number;
    saving_amount: number;
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

async function updateDecreaseDenda(dryRun: boolean = true): Promise<void> {
    console.log("=".repeat(80));
    console.log("UPDATE 5 RECORDS: Denda Turun Karena Libur Nasional");
    console.log("=".repeat(80));
    console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "PRODUCTION (will update)"}`);
    console.log("");

    const recordsToUpdate: UpdateRecord[] = [];

    for (const ulok of ULOKS_TO_UPDATE) {
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
        const spkEnd = parseDate(row.spk_end);
        const stDate = parseDate(row.st_date);

        if (!spkEnd || !stDate) {
            console.log(`⚠️  ${ulok}: Missing SPK end or ST date`);
            continue;
        }

        if (!row.id_opname_final) {
            console.log(`⚠️  ${ulok}: No opname_final record found`);
            continue;
        }

        const beforeHariDenda = parseInt(row.old_hari_denda) || 0;
        const beforeNilaiDenda = parseInt(row.old_nilai_denda) || 0;

        // Re-calculate dengan logic baru
        const calculated = calculateDendaFromDates(spkEnd, stDate);
        const afterHariDenda = calculated.hari_denda;
        const afterNilaiDenda = calculated.nilai_denda;
        const savingAmount = beforeNilaiDenda - afterNilaiDenda;

        recordsToUpdate.push({
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
            saving_amount: savingAmount
        });

        console.log(`${row.nomor_ulok} - ${row.nama_toko} (${row.cabang})`);
        console.log(`  SPK End: ${formatDate(spkEnd)}`);
        console.log(`  ST Date: ${formatDate(stDate)}`);
        console.log(`  BEFORE: ${beforeHariDenda} hari = ${formatCurrency(beforeNilaiDenda)}`);
        console.log(`  AFTER:  ${afterHariDenda} hari = ${formatCurrency(afterNilaiDenda)}`);
        console.log(`  SAVING: ${formatCurrency(savingAmount)} 💰`);
        console.log("");
    }

    // Summary
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    
    const totalRecords = recordsToUpdate.length;
    const totalBeforeAmount = recordsToUpdate.reduce((sum, r) => sum + r.before_nilai_denda, 0);
    const totalAfterAmount = recordsToUpdate.reduce((sum, r) => sum + r.after_nilai_denda, 0);
    const totalSaving = totalBeforeAmount - totalAfterAmount;

    console.log(`Total Records: ${totalRecords}`);
    console.log(`Total BEFORE: ${formatCurrency(totalBeforeAmount)}`);
    console.log(`Total AFTER:  ${formatCurrency(totalAfterAmount)}`);
    console.log(`Total SAVING: ${formatCurrency(totalSaving)} 💰`);
    console.log("=".repeat(80));
    console.log("");

    if (dryRun) {
        console.log("✅ DRY RUN complete. No changes made.");
        console.log("Run with --production flag to apply updates.");
        return;
    }

    // PRODUCTION MODE: Apply updates
    console.log("=".repeat(80));
    console.log("APPLYING UPDATES TO opname_final");
    console.log("=".repeat(80));
    console.log("");

    let updated = 0;

    for (const record of recordsToUpdate) {
        try {
            await pool.query(`
                UPDATE opname_final
                SET 
                    hari_denda = $1,
                    nilai_denda = $2
                WHERE id = $3
            `, [record.after_hari_denda, record.after_nilai_denda, record.id_opname_final]);

            console.log(`✅ ${record.nomor_ulok}: Updated ${formatCurrency(record.before_nilai_denda)} → ${formatCurrency(record.after_nilai_denda)}`);
            updated++;
        } catch (error) {
            console.error(`❌ ${record.nomor_ulok}: Failed to update - ${error}`);
        }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log(`✅ COMPLETE: Updated ${updated} of ${totalRecords} records`);
    console.log(`💰 Total Saving: ${formatCurrency(totalSaving)}`);
    console.log("=".repeat(80));
}

// Main execution
const args = process.argv.slice(2);
const isProduction = args.includes('--production');

updateDecreaseDenda(!isProduction)
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
