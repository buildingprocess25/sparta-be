/**
 * Fix script for ULOK UZ01-2606-0006 branch issue
 * 
 * This script updates the toko.cabang to SIDOARJO if needed
 * Run debug-ulok-uz01-2606-0006.ts first to confirm the issue
 */

import { pool } from "../src/db/pool";

interface TokoData {
    id: number;
    nomor_ulok: string;
    cabang: string;
    nama_toko: string;
}

async function main() {
    console.log("=".repeat(80));
    console.log("FIX: Update ULOK UZ01-2606-0006 Branch to SIDOARJO");
    console.log("=".repeat(80));
    console.log();

    // 1. Check current state
    console.log("1. Checking current ULOK data...");
    const currentResult = await pool.query<TokoData>(
        `SELECT id, nomor_ulok, cabang, nama_toko 
         FROM toko 
         WHERE nomor_ulok = 'UZ01-2606-0006'`
    );

    if (currentResult.rows.length === 0) {
        console.log("❌ ULOK UZ01-2606-0006 not found!");
        return;
    }

    const toko = currentResult.rows[0];
    console.log(`✓ Found ULOK: ${toko.nomor_ulok}`);
    console.log(`  Toko ID: ${toko.id}`);
    console.log(`  Nama: ${toko.nama_toko}`);
    console.log(`  Current Cabang: ${toko.cabang}`);
    console.log();

    // 2. Check if fix is needed
    const currentCabang = toko.cabang.toUpperCase().trim();
    const targetCabang = "SIDOARJO";

    if (currentCabang === targetCabang) {
        console.log("✅ Cabang is already SIDOARJO - no fix needed!");
        return;
    }

    // 3. Confirm before update
    console.log("⚠️  WARNING: This will update toko.cabang");
    console.log(`  From: ${toko.cabang}`);
    console.log(`  To: ${targetCabang}`);
    console.log();

    // 4. Perform update
    console.log("2. Updating toko.cabang...");
    
    const updateResult = await pool.query(
        `UPDATE toko 
         SET cabang = $1, updated_at = now()
         WHERE nomor_ulok = $2
         RETURNING id, nomor_ulok, cabang`,
        [targetCabang, 'UZ01-2606-0006']
    );

    if (updateResult.rowCount === 0) {
        console.log("❌ Update failed - no rows affected");
        return;
    }

    console.log("✅ Update successful!");
    console.log();

    // 5. Verify update
    console.log("3. Verifying update...");
    const verifyResult = await pool.query<TokoData>(
        `SELECT id, nomor_ulok, cabang, nama_toko 
         FROM toko 
         WHERE nomor_ulok = 'UZ01-2606-0006'`
    );

    const updated = verifyResult.rows[0];
    console.log(`✓ ULOK: ${updated.nomor_ulok}`);
    console.log(`  Cabang: ${updated.cabang}`);
    console.log();

    // 6. Check related documents
    console.log("4. Checking related documents...");
    
    const docsResult = await pool.query(
        `SELECT 
            'RAB' as doc_type,
            COUNT(*) as count
        FROM rab
        WHERE toko_id = $1
        UNION ALL
        SELECT 
            'SPK' as doc_type,
            COUNT(*) as count
        FROM spk
        WHERE id_toko = $1
        UNION ALL
        SELECT 
            'Gantt' as doc_type,
            COUNT(*) as count
        FROM gantt_chart
        WHERE id_toko = $1`,
        [toko.id]
    );

    console.log("Related documents:");
    docsResult.rows.forEach(row => {
        console.log(`  ${row.doc_type}: ${row.count} documents`);
    });
    console.log();

    console.log("=".repeat(80));
    console.log("✅ Fix completed successfully!");
    console.log("=".repeat(80));
    console.log();
    console.log("Next steps:");
    console.log("1. Test approval again with SIDOARJO coordinator account");
    console.log("2. If still fails, run debug script again to check other issues");
    console.log("3. Check frontend logs for any client-side issues");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
