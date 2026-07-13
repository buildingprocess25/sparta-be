/**
 * Simple test: Can SIDOARJO coordinator access UZ01-2606-0006?
 */

import { pool } from "../src/db/pool";
import {
    getEffectiveBranchesForUser,
    normalizeBranchScopeName
} from "../src/common/branch-scope";

async function testBranchAccess() {
    console.log("=".repeat(80));
    console.log("TEST: Branch Access for UZ01-2606-0006");
    console.log("=".repeat(80));
    console.log();

    // 1. Get ULOK data
    const ulokResult = await pool.query(
        `SELECT t.nomor_ulok, t.cabang, t.nama_toko
         FROM toko t
         WHERE t.nomor_ulok = 'UZ01-2606-0006'`
    );

    if (ulokResult.rows.length === 0) {
        console.log("❌ ULOK not found");
        return;
    }

    const ulok = ulokResult.rows[0];
    console.log("ULOK Data:");
    console.log(`  Nomor: ${ulok.nomor_ulok}`);
    console.log(`  Cabang: "${ulok.cabang}"`);
    console.log(`  Toko: ${ulok.nama_toko}`);
    console.log();

    // 2. Simulate SIDOARJO coordinator
    const testUser = {
        emailSat: "test@sat.co.id",  // Dummy email
        cabang: "SIDOARJO",           // User login branch
        roles: ["KOORDINATOR"]        // User role
    };

    console.log("Test User (Simulated SIDOARJO Coordinator):");
    console.log(`  Email: ${testUser.emailSat}`);
    console.log(`  Cabang: ${testUser.cabang}`);
    console.log(`  Roles: ${testUser.roles.join(", ")}`);
    console.log();

    // 3. Get effective branches
    const effectiveBranches = await getEffectiveBranchesForUser(testUser);

    console.log("Effective Branches:");
    console.log(`  Source: ${effectiveBranches.source}`);
    console.log(`  Branches (${effectiveBranches.branches.length}):`);
    effectiveBranches.branches.forEach((b, i) => {
        console.log(`    ${i + 1}. "${b}"`);
    });
    console.log();

    // 4. Test access
    const normalizedUlokCabang = normalizeBranchScopeName(ulok.cabang);
    const normalizedEffectiveBranches = effectiveBranches.branches.map(normalizeBranchScopeName);

    console.log("Access Validation:");
    console.log(`  Document cabang (normalized): "${normalizedUlokCabang}"`);
    console.log(`  User effective branches (normalized): [${normalizedEffectiveBranches.join(", ")}]`);
    console.log();

    const canAccess = normalizedEffectiveBranches.includes(normalizedUlokCabang);

    if (canAccess) {
        console.log("✅ ACCESS GRANTED!");
        console.log();
        console.log("User DAPAT mengakses dan approve RAB untuk ULOK ini.");
        console.log("Jika masih 403, masalahnya bukan di branch access logic.");
        console.log();
        console.log("Kemungkinan penyebab 403 lainnya:");
        console.log("  1. Session token expired atau invalid");
        console.log("  2. approver_email di request tidak match dengan session user");
        console.log("  3. RAB status tidak allow approval saat ini");
        console.log("  4. Ada middleware lain yang block request");
    } else {
        console.log("❌ ACCESS DENIED!");
        console.log();
        console.log("User TIDAK DAPAT mengakses ULOK ini.");
        console.log("Ini menjelaskan 403 error.");
        console.log();
        console.log("Penyebab:");
        console.log(`  Document cabang "${normalizedUlokCabang}" tidak ada dalam effective branches user.`);
        console.log();
        console.log("Solusi:");
        console.log(`  1. Fix database: UPDATE toko SET cabang = 'SIDOARJO' WHERE nomor_ulok = 'UZ01-2606-0006'`);
        console.log(`  2. Or add coverage: Give user access to "${ulok.cabang}" branch`);
    }

    console.log();
    console.log("=".repeat(80));
}

testBranchAccess()
    .then(() => {
        console.log("✅ Test completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
