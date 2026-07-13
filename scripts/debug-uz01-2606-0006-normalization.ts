/**
 * Debug: UZ01-2606-0006 Branch Normalization Issue
 * 
 * Issue: ULOK UZ01-2606-0006 dengan cabang "SIDOARJO BPN SMD" tidak bisa diapprove
 * oleh koordinator SIDOARJO
 * 
 * Root Cause Hypothesis:
 * 1. Database stores: "SIDOARJO BPN_SMD" (with underscore) or with extra spaces
 * 2. Branch group expects: "SIDOARJO BPN SMD" (with space)
 * 3. Normalization converts underscore to space, but there might be timing/matching issues
 */

import { pool } from "../src/db/pool";
import { 
    normalizeBranchScopeName, 
    getBranchScopeCandidates,
    getEffectiveBranchesForUser 
} from "../src/common/branch-scope";

async function main() {
    console.log("=".repeat(80));
    console.log("DEBUG: UZ01-2606-0006 Branch Normalization Issue");
    console.log("=".repeat(80));
    console.log();

    // 1. Check exact cabang value in database
    console.log("1. Database Value (RAW):");
    console.log("-".repeat(80));
    
    const ulokResult = await pool.query(
        `SELECT 
            t.id,
            t.nomor_ulok,
            t.cabang,
            LENGTH(t.cabang) as cabang_length,
            encode(t.cabang::bytea, 'hex') as cabang_hex,
            t.nama_toko
        FROM toko t
        WHERE t.nomor_ulok = 'UZ01-2606-0006'`
    );

    if (ulokResult.rows.length === 0) {
        console.log("❌ ULOK not found!");
        return;
    }

    const toko = ulokResult.rows[0];
    console.log(`ULOK: ${toko.nomor_ulok}`);
    console.log(`Toko: ${toko.nama_toko}`);
    console.log(`Cabang (raw): "${toko.cabang}"`);
    console.log(`Cabang length: ${toko.cabang_length}`);
    console.log(`Cabang hex: ${toko.cabang_hex}`);
    console.log();

    // 2. Test normalization
    console.log("2. Normalization Test:");
    console.log("-".repeat(80));
    
    const rawCabang = toko.cabang;
    const normalized = normalizeBranchScopeName(rawCabang);
    console.log(`Input: "${rawCabang}"`);
    console.log(`Normalized: "${normalized}"`);
    console.log();

    // 3. Check if it matches branch group
    console.log("3. Branch Group Matching:");
    console.log("-".repeat(80));
    
    const candidates = getBranchScopeCandidates(rawCabang);
    console.log(`Branch candidates:`, candidates);
    console.log();

    // Test various inputs
    const testCases = [
        "SIDOARJO BPN SMD",
        "SIDOARJO BPN_SMD",
        "SIDOARJO  BPN  SMD",
        "sidoarjo bpn smd",
        toko.cabang
    ];

    console.log("Test normalization for various inputs:");
    testCases.forEach(testCase => {
        const norm = normalizeBranchScopeName(testCase);
        const cands = getBranchScopeCandidates(testCase);
        console.log(`  "${testCase}" → "${norm}" → ${cands.length} candidates`);
    });
    console.log();

    // 4. Check SIDOARJO coordinator
    console.log("4. SIDOARJO Coordinator Access:");
    console.log("-".repeat(80));
    
    const coordinatorResult = await pool.query(
        `SELECT 
            email_sat,
            nama_lengkap,
            cabang,
            jabatan,
            roles
        FROM user_cabang
        WHERE UPPER(cabang) LIKE '%SIDOARJO%'
          AND (UPPER(jabatan) LIKE '%KOORDINATOR%' OR 'KOORDINATOR' = ANY(roles))
        LIMIT 1`
    );

    if (coordinatorResult.rows.length === 0) {
        console.log("⚠️  No SIDOARJO coordinator found");
    } else {
        const coordinator = coordinatorResult.rows[0];
        console.log(`User: ${coordinator.nama_lengkap} (${coordinator.email_sat})`);
        console.log(`Cabang: ${coordinator.cabang}`);
        console.log(`Jabatan: ${coordinator.jabatan}`);
        console.log();

        // Test effective branches
        const effectiveBranches = await getEffectiveBranchesForUser({
            emailSat: coordinator.email_sat,
            cabang: coordinator.cabang,
            roles: coordinator.roles
        });

        console.log(`Effective branches (source: ${effectiveBranches.source}):`);
        effectiveBranches.branches.forEach((b, i) => {
            console.log(`  ${i + 1}. "${b}"`);
        });
        console.log();

        // Check if toko cabang is in effective branches
        const normalizedTokoCabang = normalizeBranchScopeName(toko.cabang);
        const isAccessible = effectiveBranches.branches
            .map(normalizeBranchScopeName)
            .includes(normalizedTokoCabang);

        console.log("Access Check:");
        console.log(`  Toko cabang (normalized): "${normalizedTokoCabang}"`);
        console.log(`  In effective branches? ${isAccessible ? "✅ YES" : "❌ NO"}`);
        
        if (!isAccessible) {
            console.log();
            console.log("⚠️  FOUND THE ISSUE!");
            console.log("  The normalized toko.cabang is NOT in user's effective branches");
            console.log();
            console.log("Detailed comparison:");
            effectiveBranches.branches.forEach(b => {
                const norm = normalizeBranchScopeName(b);
                const match = norm === normalizedTokoCabang;
                console.log(`  "${b}" → "${norm}" ${match ? "✅ MATCH" : "❌ NO MATCH"}`);
            });
        }
    }
    console.log();

    // 5. Check actual RAB data
    console.log("5. RAB Data:");
    console.log("-".repeat(80));
    
    const rabResult = await pool.query(
        `SELECT 
            r.id,
            r.nomor_rab,
            r.status,
            r.nama_pt
        FROM rab r
        WHERE r.toko_id = $1
        ORDER BY r.created_at DESC
        LIMIT 1`,
        [toko.id]
    );

    if (rabResult.rows.length > 0) {
        const rab = rabResult.rows[0];
        console.log(`RAB ID: ${rab.id}`);
        console.log(`Nomor: ${rab.nomor_rab || 'N/A'}`);
        console.log(`Status: ${rab.status}`);
        console.log(`PT: ${rab.nama_pt}`);
    } else {
        console.log("⚠️  No RAB found for this toko");
    }
    console.log();

    // 6. Recommendations
    console.log("6. Analysis & Recommendations:");
    console.log("-".repeat(80));
    
    // Check if normalization produces expected value
    const expectedNormalized = "SIDOARJO BPN SMD";
    if (normalized !== expectedNormalized) {
        console.log(`❌ ISSUE: Normalization produced "${normalized}" instead of "${expectedNormalized}"`);
        console.log();
        console.log("Possible causes:");
        console.log("  1. Database has typo or extra characters");
        console.log("  2. Normalization logic has a bug");
        console.log("  3. Character encoding issue");
        console.log();
        console.log("🔧 FIX: Update toko.cabang to exact match:");
        console.log(`  UPDATE toko SET cabang = '${expectedNormalized}' WHERE id = ${toko.id};`);
    } else {
        console.log(`✅ Normalization produces correct value: "${normalized}"`);
        console.log();
        console.log("If still getting 403, check:");
        console.log("  1. Frontend might be sending wrong branch value");
        console.log("  2. There's a timing issue with normalization in the validation flow");
        console.log("  3. Branch group configuration mismatch between FE and BE");
    }

    console.log();
    console.log("=".repeat(80));
}

main()
    .then(() => {
        console.log("✅ Debug completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
