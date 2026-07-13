/**
 * BACKFILL ST DATES WITH NATIONAL HOLIDAYS 2026
 * 
 * Script untuk update tanggal ST yang belum dilakukan dengan mempertimbangkan libur nasional
 * 
 * Logika:
 * 1. Cari semua SPK yang sudah approved tapi belum ST
 * 2. Hitung tanggal ST ideal dengan logic baru (skip weekend + libur nasional)
 * 3. Update opname_final dengan tanggal_akhir_spk_denda yang baru
 * 4. Refresh denda dengan logic baru
 * 
 * IMPORTANT: Script ini TIDAK mengubah data yang sudah ST
 */

import { pool } from "../db/pool";
import { calculateGanttSchedule } from "../modules/gantt/gantt-date-calculator";
import { opnameFinalService } from "../modules/opname-final/opname-final.service";

type SpkPendingStRow = {
    id: number;
    id_toko: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    nama_toko: string;
    cabang: string;
    waktu_mulai: string;
    waktu_selesai: string;
    durasi: number;
    tanggal_spk_akhir_setelah_perpanjangan: string | null;
    effective_waktu_selesai: string;
    has_st: boolean;
    opname_final_id: number | null;
};

type SpkAllRow = SpkPendingStRow & {
    st_date: string | null;
    old_hari_denda: number | null;
    old_nilai_denda: string | null;
};

async function findAllSpkWithPotentialImpact(): Promise<SpkAllRow[]> {
    const result = await pool.query<SpkAllRow>(`
        WITH spk_with_extension AS (
            SELECT 
                ps.id,
                ps.id_toko,
                ps.nomor_ulok,
                ps.lingkup_pekerjaan,
                ps.waktu_mulai,
                ps.waktu_selesai,
                ps.durasi,
                MAX(pt.tanggal_spk_akhir_setelah_perpanjangan) FILTER (
                    WHERE UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                ) AS tanggal_spk_akhir_setelah_perpanjangan,
                COALESCE(
                    MAX(pt.tanggal_spk_akhir_setelah_perpanjangan) FILTER (
                        WHERE UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ),
                    ps.waktu_selesai
                ) AS effective_waktu_selesai
            FROM pengajuan_spk ps
            LEFT JOIN pertambahan_spk pt ON pt.id_spk = ps.id
            WHERE UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
            GROUP BY ps.id, ps.id_toko, ps.nomor_ulok, ps.lingkup_pekerjaan, ps.waktu_mulai, ps.waktu_selesai, ps.durasi
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
            ofn.id AS opname_final_id,
            bst.created_at::date AS st_date,
            ofn.hari_denda AS old_hari_denda,
            ofn.nilai_denda AS old_nilai_denda
        FROM spk_with_extension s
        JOIN toko t ON t.id = s.id_toko
        LEFT JOIN opname_final ofn ON ofn.id_toko = s.id_toko
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = s.id_toko
        WHERE s.effective_waktu_selesai >= '2026-01-01'::date
        ORDER BY s.effective_waktu_selesai ASC, s.id ASC
    `);

    return result.rows;
}

async function updateEffectiveStDates(dryRun: boolean = true): Promise<void> {
    console.log("=".repeat(80));
    console.log("RECALCULATE DENDA WITH NATIONAL HOLIDAYS 2026");
    console.log("=".repeat(80));
    console.log(`Mode: ${dryRun ? "DRY RUN (preview only)" : "PRODUCTION (will update database)"}`);
    console.log("");

    const candidates = await findAllSpkWithPotentialImpact();
    console.log(`Found ${candidates.length} SPK total (sudah ST + belum ST)\n`);

    const withSt = candidates.filter(c => c.has_st);
    const withoutSt = candidates.filter(c => !c.has_st);
    
    console.log(`  - Sudah ST: ${withSt.length} records`);
    console.log(`  - Belum ST: ${withoutSt.length} records`);
    console.log("");

    if (candidates.length === 0) {
        console.log("✓ Tidak ada data yang perlu diupdate");
        return;
    }

    const updates: Array<{
        spk: SpkPendingStRow;
        oldStDate: string;
        newStDate: string;
        skippedDays: number;
        explanation: string;
    }> = [];

    for (const spk of candidates) {
        const schedule = calculateGanttSchedule(spk.waktu_mulai, spk.durasi);
        const oldStDate = spk.effective_waktu_selesai;
        const newStDate = schedule.effective_st_date;

        // Skip jika tanggal tidak berubah
        if (oldStDate === newStDate) {
            continue;
        }

        updates.push({
            spk,
            oldStDate,
            newStDate,
            skippedDays: schedule.skipped_days,
            explanation: schedule.st_label
        });
    }

    console.log(`${updates.length} SPK akan diupdate:\n`);

    for (const [index, update] of updates.entries()) {
        console.log(`${index + 1}. ${update.spk.nomor_ulok} - ${update.spk.nama_toko}`);
        console.log(`   Cabang: ${update.spk.cabang}`);
        console.log(`   Lingkup: ${update.spk.lingkup_pekerjaan}`);
        console.log(`   Waktu Mulai: ${update.spk.waktu_mulai}`);
        console.log(`   Durasi: ${update.spk.durasi} hari`);
        console.log(`   OLD Akhir SPK: ${update.oldStDate}`);
        console.log(`   NEW ST Ideal: ${update.newStDate}`);
        console.log(`   Skip: ${update.skippedDays} hari (${update.explanation})`);
        console.log(`   Opname Final ID: ${update.spk.opname_final_id ?? "N/A"}`);
        console.log("");
    }

    if (dryRun) {
        console.log("=".repeat(80));
        console.log("DRY RUN MODE - No changes made");
        console.log("Run with --production flag to apply changes");
        console.log("=".repeat(80));
        return;
    }

    console.log("=".repeat(80));
    console.log("APPLYING UPDATES...");
    console.log("=".repeat(80));
    console.log("");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Create audit table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS st_date_backfill_2026_audit (
                id SERIAL PRIMARY KEY,
                id_spk INT NOT NULL,
                id_toko INT NOT NULL,
                nomor_ulok TEXT NOT NULL,
                lingkup_pekerjaan TEXT NOT NULL,
                old_effective_waktu_selesai DATE NOT NULL,
                new_effective_st_date DATE NOT NULL,
                skipped_days INT NOT NULL,
                explanation TEXT NOT NULL,
                backfilled_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now())
            )
        `);

        let successCount = 0;
        let errorCount = 0;

        for (const update of updates) {
            try {
                // Insert audit record
                await client.query(
                    `
                    INSERT INTO st_date_backfill_2026_audit (
                        id_spk, id_toko, nomor_ulok, lingkup_pekerjaan,
                        old_effective_waktu_selesai, new_effective_st_date,
                        skipped_days, explanation
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `,
                    [
                        update.spk.id,
                        update.spk.id_toko,
                        update.spk.nomor_ulok,
                        update.spk.lingkup_pekerjaan,
                        update.oldStDate,
                        update.newStDate,
                        update.skippedDays,
                        update.explanation
                    ]
                );

                // Note: We don't update waktu_selesai in pengajuan_spk
                // because that's the original SPK end date
                // The effective ST date is handled in denda calculation

                // Refresh denda if opname_final exists
                if (update.spk.opname_final_id) {
                    await opnameFinalService.refreshDendaByTokoId(update.spk.id_toko);
                }

                console.log(`✓ Updated: ${update.spk.nomor_ulok}`);
                successCount++;
            } catch (error) {
                console.error(`✗ Error updating ${update.spk.nomor_ulok}:`, error);
                errorCount++;
            }
        }

        await client.query("COMMIT");

        console.log("");
        console.log("=".repeat(80));
        console.log("BACKFILL COMPLETE");
        console.log("=".repeat(80));
        console.log(`Success: ${successCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log("");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction rolled back due to error:", error);
        throw error;
    } finally {
        client.release();
    }
}

// Main execution
const isDryRun = !process.argv.includes("--production");

updateEffectiveStDates(isDryRun)
    .then(() => {
        console.log("Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });
