/**
 * Script to fix Cepoko ST date to 29 Juni
 * 
 * Business decision: Pengawasan terakhir di-input 29 Juni,
 * ST should be 29 Juni (not 30 Juni)
 */

import { pool } from "../db/pool";

async function fixCepokoST() {
    console.log("=".repeat(70));
    console.log("🔧 Fix Cepoko ST Date to 29 Juni");
    console.log("=".repeat(70));
    console.log("");

    try {
        // Step 1: Show current state
        console.log("📊 STEP 1: Current State");
        console.log("-".repeat(70));
        
        const before = await pool.query(`
            SELECT 
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date_current,
                TO_CHAR(bst.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') AS st_datetime_current,
                ofn.hari_denda AS denda_current,
                ofn.nilai_denda AS nilai_denda_current
            FROM toko t
            JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            JOIN opname_final ofn ON ofn.id_toko = t.id
            WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
        `);

        if (before.rows.length === 0) {
            console.log("❌ Toko Cepoko tidak ditemukan!");
            process.exit(1);
        }

        const current = before.rows[0];
        console.log(`Toko: ${current.nama_toko}`);
        console.log(`ULOK: ${current.nomor_ulok}`);
        console.log(`ST Date (Current): ${current.st_date_current}`);
        console.log(`ST DateTime (Current): ${current.st_datetime_current}`);
        console.log(`Denda (Current): ${current.denda_current} hari = Rp ${current.nilai_denda_current}`);
        console.log("");

        // Step 2: Update ST date to 29 Juni (use pengawasan input time as reference)
        console.log("🔧 STEP 2: Update ST Date to 29 Juni");
        console.log("-".repeat(70));
        
        // Get pengawasan input time (29 Juni 08:17:59)
        const pengawasanTime = await pool.query(`
            SELECT 
                MIN(p.created_at) AS first_pengawasan_created_at
            FROM pengawasan p
            JOIN gantt_chart g ON g.id = p.id_gantt
            JOIN toko t ON t.id = g.id_toko
            WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
              AND DATE(p.created_at AT TIME ZONE 'Asia/Jakarta') = '2026-06-29'
        `);

        const targetTimestamp = pengawasanTime.rows[0]?.first_pengawasan_created_at || '2026-06-29 08:17:59';
        console.log(`Target ST Timestamp: ${targetTimestamp}`);
        console.log("");

        // Update berkas_serah_terima
        await pool.query(`
            UPDATE berkas_serah_terima bst
            SET created_at = $1::timestamptz
            FROM toko t
            WHERE bst.id_toko = t.id
              AND UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
        `, [targetTimestamp]);

        console.log("✅ Updated berkas_serah_terima.created_at");

        // Update opname_final denda
        await pool.query(`
            UPDATE opname_final ofn
            SET 
                hari_denda = 0,
                nilai_denda = 0,
                tanggal_serah_terima_denda = '2026-06-29'
            FROM toko t
            WHERE ofn.id_toko = t.id
              AND UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
        `);

        console.log("✅ Updated opname_final denda to 0");
        console.log("");

        // Step 3: Verify
        console.log("✅ STEP 3: Verification");
        console.log("-".repeat(70));
        
        const after = await pool.query(`
            SELECT 
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date_after,
                TO_CHAR(bst.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') AS st_datetime_after,
                ofn.hari_denda AS denda_after,
                ofn.nilai_denda AS nilai_denda_after,
                ofn.tanggal_serah_terima_denda
            FROM toko t
            JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            JOIN opname_final ofn ON ofn.id_toko = t.id
            WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
        `);

        const result = after.rows[0];
        console.log(`Toko: ${result.nama_toko}`);
        console.log(`ULOK: ${result.nomor_ulok}`);
        console.log(`ST Date (After): ${result.st_date_after}`);
        console.log(`ST DateTime (After): ${result.st_datetime_after}`);
        console.log(`Denda (After): ${result.denda_after} hari = Rp ${result.nilai_denda_after}`);
        console.log(`Tanggal ST Denda: ${result.tanggal_serah_terima_denda}`);
        console.log("");

        if (result.st_date_after === '2026-06-29' && result.denda_after === 0) {
            console.log("✅ SUCCESS: ST date fixed to 29 Juni, denda cleared!");
        } else {
            console.log("⚠️ WARNING: Something might be wrong, please verify manually");
        }

        console.log("");
        console.log("=".repeat(70));
        console.log("🎉 Fix Completed!");
        console.log("=".repeat(70));

    } catch (error) {
        console.error("❌ Error:", error);
        throw error;
    } finally {
        await pool.end();
    }
}

fixCepokoST()
    .then(() => {
        console.log("\n✅ Script finished successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
