/**
 * Script to audit user branch coverage after Alfamart restructuring
 * 
 * Usage:
 *   npm run tsx scripts/audit-branch-coverage.ts
 * 
 * Or with email filter:
 *   npm run tsx scripts/audit-branch-coverage.ts firman@gmail.com
 */

import { pool } from "../src/db/pool";
import { getEffectiveBranchesForUser, BRANCH_GROUPS } from "../src/common/branch-scope";

type UserRow = {
    id: number;
    email_sat: string;
    cabang: string;
    nama_lengkap: string | null;
    jabatan: string | null;
};

type CoverageRow = {
    covered_cabang: string;
};

async function auditUserBranchCoverage(emailFilter?: string) {
    console.log("=".repeat(80));
    console.log("AUDIT: User Branch Coverage After Alfamart Restructuring");
    console.log("=".repeat(80));
    console.log();

    // Get all users or filter by email
    const usersQuery = emailFilter
        ? `SELECT id, email_sat, cabang, nama_lengkap, jabatan 
           FROM user_cabang 
           WHERE LOWER(email_sat) LIKE LOWER($1)
           ORDER BY cabang, email_sat`
        : `SELECT id, email_sat, cabang, nama_lengkap, jabatan 
           FROM user_cabang 
           ORDER BY cabang, email_sat`;
    
    const usersParams = emailFilter ? [`%${emailFilter}%`] : [];
    const usersResult = await pool.query<UserRow>(usersQuery, usersParams);

    if (usersResult.rows.length === 0) {
        console.log("❌ No users found");
        return;
    }

    console.log(`Found ${usersResult.rows.length} users\n`);

    for (const user of usersResult.rows) {
        console.log("-".repeat(80));
        console.log(`👤 User: ${user.nama_lengkap || user.email_sat}`);
        console.log(`   Email: ${user.email_sat}`);
        console.log(`   Cabang Login: ${user.cabang}`);
        console.log(`   Jabatan: ${user.jabatan || "N/A"}`);
        console.log();

        // Get coverage from user_branch_coverage
        const coverageResult = await pool.query<CoverageRow>(
            `SELECT covered_cabang 
             FROM user_branch_coverage 
             WHERE user_cabang_id = $1
             ORDER BY covered_cabang`,
            [user.id]
        );

        console.log(`   📋 Coverage Table (user_branch_coverage):`);
        if (coverageResult.rows.length === 0) {
            console.log(`      ⚠️  No coverage found - will fallback to login branch only`);
        } else {
            coverageResult.rows.forEach(row => {
                console.log(`      - ${row.covered_cabang}`);
            });
        }
        console.log();

        // Get effective branches using new logic
        const roles = user.jabatan ? [user.jabatan] : [];
        const effective = await getEffectiveBranchesForUser({
            emailSat: user.email_sat,
            cabang: user.cabang,
            roles
        });

        console.log(`   ✅ Effective Accessible Branches:`);
        console.log(`      Source: ${effective.source.toUpperCase()}`);
        effective.branches.forEach(branch => {
            console.log(`      - ${branch}`);
        });
        console.log();

        // Show branch group info
        const branchGroupEntry = Object.entries(BRANCH_GROUPS).find(([parent, group]) =>
            group.includes(user.cabang.toUpperCase())
        );
        if (branchGroupEntry) {
            const [parentName, groupBranches] = branchGroupEntry;
            console.log(`   ℹ️  Branch Group Info:`);
            console.log(`      Parent: ${parentName}`);
            console.log(`      Group Members: ${groupBranches.join(", ")}`);
        }

        console.log();
    }

    console.log("=".repeat(80));
    console.log("✅ Audit complete");
    console.log("=".repeat(80));
}

async function main() {
    const emailFilter = process.argv[2];
    
    if (emailFilter) {
        console.log(`Filtering by email: ${emailFilter}\n`);
    }

    try {
        await auditUserBranchCoverage(emailFilter);
    } catch (error) {
        console.error("❌ Audit failed:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
