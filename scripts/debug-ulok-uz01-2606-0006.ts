/**
 * Debug script for ULOK UZ01-2606-0006 approval 403 issue
 * 
 * This script:
 * 1. Checks ULOK and RAB data
 * 2. Checks user coordinator SIDOARJO data
 * 3. Validates branch coverage
 * 4. Provides fix recommendations
 */

import { pool } from "../src/db/pool";
import { getEffectiveBranchesForUser } from "../src/common/branch-scope";

interface TokoRabData {
    nomor_ulok: string;
    toko_cabang: string;
    nama_toko: string;
    rab_id: string | null;
    rab_status: string | null;
    nomor_rab: string | null;
}

interface UserData {
    email_sat: string;
    nama_lengkap: string;
    cabang: string;
    jabatan: string;
    roles: string[];
}

interface UserCoverageData {
    nama_lengkap: string;
    login_branch: string;
    covered_cabang: string | null;
}

async function main() {
    console.log("=".repeat(80));
    console.log("DEBUG: ULOK UZ01-2606-0006 - 403 Approval Issue");
    console.log("=".repeat(80));
    console.log();

    // 1. Check ULOK and RAB data
    console.log("1. ULOK & RAB Data:");
    console.log("-".repeat(80));
    
    const ulokResult = await pool.query<TokoRabData>(
        `
        SELECT 
            t.nomor_ulok,
            t.cabang as toko_cabang,
            t.nama_toko,
            r.id as rab_id,
            r.status as rab_status,
            r.nomor_rab
        FROM toko t
        LEFT JOIN rab r ON r.toko_id = t.id
        WHERE t.nomor_ulok = 'UZ01-2606-0006'
        ORDER BY r.created_at DESC
        LIMIT 1
        `
    );

    if (ulokResult.rows.length === 0) {
        console.log("❌ ULOK UZ01-2606-0006 NOT FOUND in database!");
        console.log("\nPossible reasons:");
        console.log("  - ULOK belum diinput");
        console.log("  - Typo in ULOK number");
        console.log("  - Data sudah dihapus");
        return;
    }

    const ulokData = ulokResult.rows[0];
    console.log(`✓ ULOK Found: ${ulokData.nomor_ulok}`);
    console.log(`  Toko: ${ulokData.nama_toko}`);
    console.log(`  Cabang: ${ulokData.toko_cabang}`);
    if (ulokData.rab_id) {
        console.log(`  RAB ID: ${ulokData.rab_id}`);
        console.log(`  RAB Status: ${ulokData.rab_status}`);
        console.log(`  Nomor RAB: ${ulokData.nomor_rab}`);
    } else {
        console.log(`  ⚠️  No RAB data found for this ULOK`);
    }
    console.log();

    // 2. Check SIDOARJO coordinator
    console.log("2. SIDOARJO Coordinator Users:");
    console.log("-".repeat(80));
    
    const userResult = await pool.query<UserData>(
        `
        SELECT 
            email_sat,
            nama_lengkap,
            cabang,
            jabatan,
            roles
        FROM user_cabang
        WHERE UPPER(cabang) LIKE '%SIDOARJO%'
          AND UPPER(jabatan) LIKE '%KOORDINATOR%'
        ORDER BY nama_lengkap
        `
    );

    if (userResult.rows.length === 0) {
        console.log("⚠️  No SIDOARJO coordinator found");
    } else {
        userResult.rows.forEach(user => {
            console.log(`✓ ${user.nama_lengkap} (${user.email_sat})`);
            console.log(`  Cabang: ${user.cabang}`);
            console.log(`  Jabatan: ${user.jabatan}`);
            console.log(`  Roles: ${user.roles.join(", ")}`);
        });
    }
    console.log();

    // 3. Check user coverage
    console.log("3. User Branch Coverage:");
    console.log("-".repeat(80));
    
    const coverageResult = await pool.query<UserCoverageData>(
        `
        SELECT 
            uc.nama_lengkap,
            uc.cabang as login_branch,
            ubc.covered_cabang
        FROM user_cabang uc
        LEFT JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
        WHERE UPPER(uc.cabang) LIKE '%SIDOARJO%'
          AND UPPER(uc.jabatan) LIKE '%KOORDINATOR%'
        ORDER BY uc.nama_lengkap
        `
    );

    if (coverageResult.rows.length === 0 || coverageResult.rows.every(r => !r.covered_cabang)) {
        console.log("✓ No explicit coverage (SIDOARJO uses branch_group rules)");
        console.log("  This is CORRECT for SIDOARJO");
    } else {
        coverageResult.rows.forEach(cov => {
            if (cov.covered_cabang) {
                console.log(`✓ ${cov.nama_lengkap}: ${cov.covered_cabang}`);
            }
        });
    }
    console.log();

    // 4. Validate access with branch-scope logic
    console.log("4. Branch Access Validation:");
    console.log("-".repeat(80));

    if (userResult.rows.length > 0) {
        const testUser = userResult.rows[0];
        console.log(`Testing with: ${testUser.nama_lengkap}`);
        
        const effectiveBranches = await getEffectiveBranchesForUser({
            emailSat: testUser.email_sat,
            cabang: testUser.cabang,
            roles: testUser.roles
        });

        console.log(`\nEffective branches for ${testUser.cabang}:`);
        console.log(`  Source: ${effectiveBranches.source}`);
        console.log(`  Branches: [${effectiveBranches.branches.join(", ")}]`);
        
        const canAccessUlok = effectiveBranches.branches
            .map(b => b.toUpperCase().trim())
            .includes(ulokData.toko_cabang.toUpperCase().trim());
        
        console.log(`\nCan access ULOK ${ulokData.nomor_ulok} (${ulokData.toko_cabang})? ${canAccessUlok ? "✅ YES" : "❌ NO"}`);

        if (!canAccessUlok) {
            console.log("\n" + "!".repeat(80));
            console.log("⚠️  THIS IS THE ROOT CAUSE OF 403 FORBIDDEN!");
            console.log("!".repeat(80));
        }
    }
    console.log();

    // 5. Recommendations
    console.log("5. Recommendations:");
    console.log("-".repeat(80));

    if (userResult.rows.length > 0) {
        const testUser = userResult.rows[0];
        const effectiveBranches = await getEffectiveBranchesForUser({
            emailSat: testUser.email_sat,
            cabang: testUser.cabang,
            roles: testUser.roles
        });

        const canAccessUlok = effectiveBranches.branches
            .map(b => b.toUpperCase().trim())
            .includes(ulokData.toko_cabang.toUpperCase().trim());

        if (!canAccessUlok) {
            console.log("🔧 OPTION 1: Fix ULOK Data (Recommended if ULOK should be SIDOARJO)");
            console.log(`   UPDATE toko SET cabang = 'SIDOARJO' WHERE nomor_ulok = 'UZ01-2606-0006';`);
            console.log();
            
            console.log("🔧 OPTION 2: Add User Coverage (If coordinator needs cross-branch access)");
            console.log(`   INSERT INTO user_branch_coverage (user_cabang_id, covered_cabang)`);
            console.log(`   SELECT id, '${ulokData.toko_cabang}' FROM user_cabang`);
            console.log(`   WHERE email_sat = '${testUser.email_sat}' AND cabang = '${testUser.cabang}';`);
            console.log();
            
            console.log("🔧 OPTION 3: Expand Branch Group (If business rule changed)");
            console.log(`   Update SIDOARJO group in branch-scope.ts to include '${ulokData.toko_cabang}'`);
        } else {
            console.log("✅ Access validation passed! No fix needed for branch access.");
            console.log("\nIf you still get 403, check:");
            console.log("  1. Session token is valid and not expired");
            console.log("  2. User email in session matches approver_email in request");
            console.log("  3. RAB status allows approval action");
        }
    }

    console.log();
    console.log("=".repeat(80));
    console.log("Debug completed");
    console.log("=".repeat(80));
}

main()
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
