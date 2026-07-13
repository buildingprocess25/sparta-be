/**
 * Fix all SIDOARJO BPN SMD branch name variations
 * 
 * Problem: Database has inconsistent values:
 * - "SIDOARJO BPN_SMD" (underscore)
 * - "SIDOARJO  BPN  SMD" (double spaces)
 * - "sidoarjo bpn smd" (lowercase)
 * 
 * Solution: Standardize to "SIDOARJO BPN SMD" (uppercase, single space, no underscore)
 */

import { pool } from "../src/db/pool";

interface BranchVariant {
    table_name: string;
    column_name: string;
    cabang: string;
    count: number;
}

const CANONICAL_BPN_SMD = "SIDOARJO BPN SMD";

async function findAllBPNSMDVariants(): Promise<BranchVariant[]> {
    const queries = [
        // toko table
        `SELECT 
            'toko' as table_name,
            'cabang' as column_name,
            cabang,
            COUNT(*) as count
        FROM toko
        WHERE (
            UPPER(cabang) LIKE '%SIDOARJO%'
            AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
            AND cabang != '${CANONICAL_BPN_SMD}'
        )
        GROUP BY cabang`,
        
        // user_cabang table
        `SELECT 
            'user_cabang' as table_name,
            'cabang' as column_name,
            cabang,
            COUNT(*) as count
        FROM user_cabang
        WHERE (
            UPPER(cabang) LIKE '%SIDOARJO%'
            AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
            AND cabang != '${CANONICAL_BPN_SMD}'
        )
        GROUP BY cabang`,
    ];

    const results: BranchVariant[] = [];
    
    for (const query of queries) {
        const result = await pool.query<BranchVariant>(query);
        results.push(...result.rows);
    }

    return results;
}

async function fixTokoTable(): Promise<number> {
    const result = await pool.query(
        `UPDATE toko
        SET cabang = $1,
            updated_at = now()
        WHERE (
            UPPER(cabang) LIKE '%SIDOARJO%'
            AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
            AND cabang != $1
        )
        RETURNING id, nomor_ulok, cabang`,
        [CANONICAL_BPN_SMD]
    );

    return result.rowCount ?? 0;
}

async function fixUserCabangTable(): Promise<number> {
    const result = await pool.query(
        `UPDATE user_cabang
        SET cabang = $1,
            updated_at = now()
        WHERE (
            UPPER(cabang) LIKE '%SIDOARJO%'
            AND (UPPER(cabang) LIKE '%BPN%SMD%' OR UPPER(cabang) LIKE '%BPN_SMD%')
            AND cabang != $1
        )
        RETURNING id, email_sat, nama_lengkap, cabang`,
        [CANONICAL_BPN_SMD]
    );

    return result.rowCount ?? 0;
}

async function verifyFix(): Promise<void> {
    console.log("\n" + "=".repeat(80));
    console.log("VERIFICATION");
    console.log("=".repeat(80));

    // Check toko
    const tokoResult = await pool.query(
        `SELECT 
            cabang,
            COUNT(*) as count
        FROM toko
        WHERE UPPER(cabang) LIKE '%SIDOARJO%'
          AND (UPPER(cabang) LIKE '%BPN%' OR UPPER(cabang) LIKE '%SMD%')
        GROUP BY cabang
        ORDER BY cabang`
    );

    console.log("\nToko table - SIDOARJO BPN variants:");
    if (tokoResult.rows.length === 0) {
        console.log("  (no records found)");
    } else {
        tokoResult.rows.forEach((row: any) => {
            const status = row.cabang === CANONICAL_BPN_SMD ? "✅" : "⚠️";
            console.log(`  ${status} "${row.cabang}": ${row.count} records`);
        });
    }

    // Check user_cabang
    const userResult = await pool.query(
        `SELECT 
            cabang,
            COUNT(*) as count
        FROM user_cabang
        WHERE UPPER(cabang) LIKE '%SIDOARJO%'
          AND (UPPER(cabang) LIKE '%BPN%' OR UPPER(cabang) LIKE '%SMD%')
        GROUP BY cabang
        ORDER BY cabang`
    );

    console.log("\nUser_cabang table - SIDOARJO BPN variants:");
    if (userResult.rows.length === 0) {
        console.log("  (no records found)");
    } else {
        userResult.rows.forEach((row: any) => {
            const status = row.cabang === CANONICAL_BPN_SMD ? "✅" : "⚠️";
            console.log(`  ${status} "${row.cabang}": ${row.count} records`);
        });
    }

    // Check specific ULOK
    const ulokResult = await pool.query(
        `SELECT 
            t.nomor_ulok,
            t.cabang,
            t.nama_toko
        FROM toko t
        WHERE t.nomor_ulok = 'UZ01-2606-0006'`
    );

    console.log("\nSpecific check - UZ01-2606-0006:");
    if (ulokResult.rows.length > 0) {
        const ulok = ulokResult.rows[0];
        const status = ulok.cabang === CANONICAL_BPN_SMD ? "✅" : "⚠️";
        console.log(`  ${status} ULOK: ${ulok.nomor_ulok}`);
        console.log(`     Toko: ${ulok.nama_toko}`);
        console.log(`     Cabang: "${ulok.cabang}"`);
    } else {
        console.log("  ⚠️  ULOK not found");
    }
}

async function main() {
    console.log("=".repeat(80));
    console.log("FIX: Standardize SIDOARJO BPN SMD Branch Names");
    console.log("=".repeat(80));
    console.log(`Target canonical name: "${CANONICAL_BPN_SMD}"`);
    console.log();

    // Step 1: Find all variants
    console.log("Step 1: Finding all BPN SMD variants...");
    console.log("-".repeat(80));
    
    const variants = await findAllBPNSMDVariants();
    
    if (variants.length === 0) {
        console.log("✅ No variants found - all branches already use canonical name!");
        await verifyFix();
        return;
    }

    console.log("\nFound variants:");
    let totalAffected = 0;
    variants.forEach(v => {
        console.log(`  ⚠️  Table: ${v.table_name}.${v.column_name}`);
        console.log(`     Value: "${v.cabang}"`);
        console.log(`     Count: ${v.count}`);
        totalAffected += v.count;
    });
    console.log();
    console.log(`Total affected records: ${totalAffected}`);
    console.log();

    // Step 2: Preview changes
    console.log("Step 2: Preview changes...");
    console.log("-".repeat(80));
    console.log(`All variants will be updated to: "${CANONICAL_BPN_SMD}"`);
    console.log();

    // Step 3: Execute fixes
    console.log("Step 3: Executing fixes...");
    console.log("-".repeat(80));

    const tokoFixed = await fixTokoTable();
    console.log(`✅ Toko table: ${tokoFixed} records updated`);

    const userFixed = await fixUserCabangTable();
    console.log(`✅ User_cabang table: ${userFixed} records updated`);

    const totalFixed = tokoFixed + userFixed;
    console.log();
    console.log(`Total records fixed: ${totalFixed}`);

    // Step 4: Verify
    await verifyFix();

    console.log();
    console.log("=".repeat(80));
    console.log("✅ Fix completed successfully!");
    console.log("=".repeat(80));
    console.log();
    console.log("Next steps:");
    console.log("1. Restart backend to ensure any cached values are cleared");
    console.log("2. Test approval with SIDOARJO coordinator account");
    console.log("3. If using UZ01-2606-0006, verify it now shows correct branch");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
