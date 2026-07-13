/**
 * Check RAB status and approval eligibility for UZ01-2606-0006
 */

import { pool } from "../src/db/pool";

async function checkRabStatus() {
    console.log("=".repeat(80));
    console.log("CHECK: RAB Status for UZ01-2606-0006");
    console.log("=".repeat(80));
    console.log();

    // Get RAB data
    const result = await pool.query(
        `SELECT 
            r.id,
            r.nomor_rab,
            r.status,
            r.nama_pt,
            r.pemberi_persetujuan_koordinator,
            r.waktu_persetujuan_koordinator,
            r.pemberi_persetujuan_manager,
            r.waktu_persetujuan_manager,
            r.pemberi_persetujuan_direktur,
            r.waktu_persetujuan_direktur,
            r.created_at,
            t.nomor_ulok,
            t.cabang,
            t.nama_toko
        FROM rab r
        JOIN toko t ON t.id = r.toko_id
        WHERE t.nomor_ulok = 'UZ01-2606-0006'
        ORDER BY r.created_at DESC
        LIMIT 1`
    );

    if (result.rows.length === 0) {
        console.log("❌ No RAB found for this ULOK");
        return;
    }

    const rab = result.rows[0];

    console.log("RAB Information:");
    console.log(`  RAB ID: ${rab.id}`);
    console.log(`  Nomor RAB: ${rab.nomor_rab || "(not set)"}`);
    console.log(`  Status: ${rab.status}`);
    console.log(`  PT: ${rab.nama_pt}`);
    console.log(`  Created: ${rab.created_at}`);
    console.log();

    console.log("ULOK Information:");
    console.log(`  ULOK: ${rab.nomor_ulok}`);
    console.log(`  Cabang: ${rab.cabang}`);
    console.log(`  Toko: ${rab.nama_toko}`);
    console.log();

    console.log("Approval History:");
    console.log(`  Koordinator: ${rab.pemberi_persetujuan_koordinator || "(pending)"}`);
    console.log(`    Waktu: ${rab.waktu_persetujuan_koordinator || "-"}`);
    console.log(`  Manager: ${rab.pemberi_persetujuan_manager || "(pending)"}`);
    console.log(`    Waktu: ${rab.waktu_persetujuan_manager || "-"}`);
    console.log(`  Direktur: ${rab.pemberi_persetujuan_direktur || "(pending)"}`);
    console.log(`    Waktu: ${rab.waktu_persetujuan_direktur || "-"}`);
    console.log();

    // Check if status allows approval
    const COORDINATOR_STATUSES = [
        "WAITING_FOR_COORDINATOR_APPROVAL",
        "COORDINATOR_REJECTED"
    ];

    const canCoordinatorApprove = COORDINATOR_STATUSES.includes(rab.status);

    console.log("Approval Eligibility:");
    if (canCoordinatorApprove) {
        console.log(`  ✅ Status "${rab.status}" allows KOORDINATOR to approve/reject`);
    } else {
        console.log(`  ❌ Status "${rab.status}" does NOT allow KOORDINATOR action`);
        console.log();
        console.log("Expected statuses for KOORDINATOR approval:");
        COORDINATOR_STATUSES.forEach(s => console.log(`    - ${s}`));
        console.log();
        console.log("⚠️  THIS MIGHT BE WHY YOU GET 403!");
        console.log("If RAB is in a different approval stage, koordinator cannot act on it.");
    }

    console.log();
    console.log("=".repeat(80));
}

checkRabStatus()
    .then(() => {
        console.log("✅ Check completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
