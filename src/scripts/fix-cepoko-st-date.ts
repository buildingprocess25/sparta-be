/**
 * Script to fix Cepoko Serah Terima date bug
 * 
 * Bug: Serah Terima tercatat tanggal 30 Juni, padahal kontraktor submit Opname tanggal 29 Juni.
 * Root cause: Background job auto-generate ST melewati tengah malam, sehingga created_at
 * menggunakan timestamp 30 Juni instead of 29 Juni (tanggal Opname).
 * 
 * Fix: Sync berkas_serah_terima.created_at dengan opname_final.created_at
 * 
 * Usage: npx tsx src/scripts/fix-cepoko-st-date.ts
 */

import { pool } from "../db/pool";

type DiagnosticResult = {
    toko_id: number;
    nomor_ulok: string | null;
    nama_toko: string | null;
    lingkup_pekerjaan: string | null;
    opname_date: string | null;
    st_date: string | null;
    current_denda: number | null;
};

type FixResult = {
    toko_id: number;
    nomor_ulok: string | null;
    nama_toko: string | null;
    lingkup_pekerjaan: string | null;
    opname_date_after: string | null;
    st_date_after: string | null;
    denda_after: number | null;
    verification_status: string | null;
};

async function runFix() {
    console.log("=".repeat(60));
    console.log("🔧 Fix Cepoko Serah Terima Date Bug");
    console.log("=".repeat(60));
    console.log("");

    try {
        // ============================================================
        // STEP 1: Diagnostic - Show Current State
        // ============================================================
        console.log("📊 STEP 1: Diagnostic - Current State");
        console.log("-".repeat(60));

        const diagnosticResult = await pool.query<DiagnosticResult>(`
            SELECT 
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                t.lingkup_pekerjaan,
                DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS opname_date,
                DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date,
                ofn.hari_denda AS current_denda
            FROM toko t
            LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
            LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
               OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%'
        `);

        if (diagnosticResult.rows.length === 0) {
            console.log("❌ Toko Cepoko tidak ditemukan!");
            console.log("   Pastikan nama toko atau ULOK benar.");
            process.exit(1);
        }

        console.log(`✅ Found ${diagnosticResult.rows.length} toko(s) matching Cepoko\n`);

        diagnosticResult.rows.forEach((row) => {
            console.log(`📌 Toko ID: ${row.toko_id}`);
            console.log(`   ULOK: ${row.nomor_ulok}`);
            console.log(`   Nama: ${row.nama_toko}`);
            console.log(`   Lingkup: ${row.lingkup_pekerjaan}`);
            console.log(`   Opname Date: ${row.opname_date}`);
            console.log(`   ST Date: ${row.st_date}`);
            console.log(`   Current Denda: ${row.current_denda} hari`);

            if (row.st_date && row.opname_date && row.st_date > row.opname_date) {
                console.log(`   ❌ BUG DETECTED: ST date (${row.st_date}) > Opname date (${row.opname_date})`);
            } else {
                console.log(`   ✅ OK: ST date matches Opname date`);
            }
            console.log("");
        });

        // ============================================================
        // STEP 2: Create Audit Table
        // ============================================================
        console.log("📋 STEP 2: Create Audit Table");
        console.log("-".repeat(60));

        await pool.query(`
            CREATE TABLE IF NOT EXISTS serah_terima_date_fix_audit (
                id SERIAL PRIMARY KEY,
                toko_id INTEGER NOT NULL,
                nomor_ulok TEXT,
                nama_toko TEXT,
                lingkup_pekerjaan TEXT,
                
                old_st_created_at TIMESTAMP,
                old_opname_created_at TIMESTAMP,
                old_hari_denda INTEGER,
                old_nilai_denda NUMERIC,
                old_tanggal_serah_terima_denda DATE,
                
                new_st_created_at TIMESTAMP,
                new_hari_denda INTEGER,
                new_nilai_denda NUMERIC,
                new_tanggal_serah_terima_denda DATE,
                
                fix_reason TEXT,
                fixed_at TIMESTAMP NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
                fixed_by TEXT DEFAULT 'SYSTEM_ADMIN'
            )
        `);

        console.log("✅ Audit table ready\n");

        // ============================================================
        // STEP 3: Backup Data to Audit
        // ============================================================
        console.log("💾 STEP 3: Backup Data to Audit");
        console.log("-".repeat(60));

        const auditInsert = await pool.query(`
            INSERT INTO serah_terima_date_fix_audit (
                toko_id,
                nomor_ulok,
                nama_toko,
                lingkup_pekerjaan,
                old_st_created_at,
                old_opname_created_at,
                old_hari_denda,
                old_nilai_denda,
                old_tanggal_serah_terima_denda,
                new_st_created_at,
                new_hari_denda,
                new_nilai_denda,
                new_tanggal_serah_terima_denda,
                fix_reason
            )
            SELECT 
                t.id,
                t.nomor_ulok,
                t.nama_toko,
                t.lingkup_pekerjaan,
                bst.created_at,
                ofn.created_at,
                ofn.hari_denda,
                ofn.nilai_denda,
                ofn.tanggal_serah_terima_denda,
                ofn.created_at,
                0,
                0,
                DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta'),
                'Bug: Background job auto-generate ST melewati tengah malam. ST tercatat 30 Juni instead of 29 Juni (tanggal Opname).'
            FROM toko t
            JOIN opname_final ofn ON ofn.id_toko = t.id
            JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            WHERE (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
              AND DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') > DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
            RETURNING id
        `);

        console.log(`✅ Backed up ${auditInsert.rowCount} record(s) to audit table\n`);

        if ((auditInsert.rowCount ?? 0) === 0) {
            console.log("ℹ️  No records need fixing (ST dates already match Opname dates)");
            console.log("   Script completed successfully.");
            process.exit(0);
        }

        // ============================================================
        // STEP 4: Fix berkas_serah_terima.created_at
        // ============================================================
        console.log("🔧 STEP 4: Fix berkas_serah_terima.created_at");
        console.log("-".repeat(60));

        const stUpdate = await pool.query(`
            UPDATE berkas_serah_terima bst
            SET created_at = ofn.created_at
            FROM toko t
            JOIN opname_final ofn ON ofn.id_toko = t.id
            WHERE bst.id_toko = t.id
              AND (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
              AND DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') > DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
            RETURNING bst.id
        `);

        console.log(`✅ Updated ${stUpdate.rowCount} berkas_serah_terima record(s)\n`);

        // ============================================================
        // STEP 5: Recalculate Denda
        // ============================================================
        console.log("🔧 STEP 5: Recalculate Denda");
        console.log("-".repeat(60));

        const dendaUpdate = await pool.query(`
            UPDATE opname_final ofn
            SET 
                hari_denda = 0,
                nilai_denda = 0,
                tanggal_serah_terima_denda = DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
            FROM toko t
            WHERE ofn.id_toko = t.id
              AND (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
              AND ofn.hari_denda > 0
            RETURNING ofn.id
        `);

        console.log(`✅ Recalculated denda for ${dendaUpdate.rowCount} opname_final record(s)\n`);

        // ============================================================
        // STEP 6: Verification - Show After State
        // ============================================================
        console.log("✅ STEP 6: Verification - After Fix");
        console.log("-".repeat(60));

        const verificationResult = await pool.query<FixResult>(`
            SELECT 
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                t.lingkup_pekerjaan,
                DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS opname_date_after,
                DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date_after,
                ofn.hari_denda AS denda_after,
                CASE 
                    WHEN DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') = DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
                         AND ofn.hari_denda = 0
                    THEN '✅ FIXED: ST synced with Opname, denda = 0'
                    WHEN DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') = DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta')
                         AND ofn.hari_denda > 0
                    THEN '⚠️ WARNING: ST synced but denda still > 0'
                    ELSE '❌ FAILED: ST not synced'
                END AS verification_status
            FROM toko t
            LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
            LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
               OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%'
        `);

        verificationResult.rows.forEach((row) => {
            console.log(`📌 Toko ID: ${row.toko_id}`);
            console.log(`   ULOK: ${row.nomor_ulok}`);
            console.log(`   Nama: ${row.nama_toko}`);
            console.log(`   Lingkup: ${row.lingkup_pekerjaan}`);
            console.log(`   ST Date (After): ${row.st_date_after}`);
            console.log(`   Denda (After): ${row.denda_after} hari`);
            console.log(`   ${row.verification_status}`);
            console.log("");
        });

        // ============================================================
        // STEP 7: Summary Report
        // ============================================================
        console.log("📊 STEP 7: Summary Report");
        console.log("-".repeat(60));

        const summaryResult = await pool.query<{
            total_fixed: number;
            total_denda_cleared: number;
            total_nilai_cleared: string;
        }>(`
            SELECT 
                COUNT(*)::int AS total_fixed,
                SUM(old_hari_denda - new_hari_denda)::int AS total_denda_cleared,
                SUM(old_nilai_denda - new_nilai_denda)::text AS total_nilai_cleared
            FROM serah_terima_date_fix_audit
            WHERE fixed_at >= timezone('Asia/Jakarta', now()) - INTERVAL '5 minutes'
        `);

        const summary = summaryResult.rows[0];
        console.log(`✅ Total records fixed: ${summary?.total_fixed ?? 0}`);
        console.log(`✅ Total denda hari cleared: ${summary?.total_denda_cleared ?? 0} hari`);
        console.log(`✅ Total nilai denda cleared: Rp ${summary?.total_nilai_cleared ?? 0}`);
        console.log("");
        console.log("=".repeat(60));
        console.log("🎉 Migration completed successfully!");
        console.log("=".repeat(60));

    } catch (error) {
        console.error("❌ Error during fix:", error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the fix
runFix()
    .then(() => {
        console.log("\n✅ Script finished successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
