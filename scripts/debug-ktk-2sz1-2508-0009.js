/**
 * DEBUG SCRIPT: Investigasi KTK Direktur Kontraktor Bug - ULOK 2SZ1-2508-0009
 * Run: node scripts/debug-ktk-2sz1-2508-0009.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '../sparta-be.env' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const normalizeCompanyName = (name) => {
    if (!name) return "";
    return name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/^(PT|CV)/g, "")
        .replace(/(PT|CV)$/g, "")
        .trim();
};

const debugKTK = async () => {
    const targetUlok = "2SZ1-2508-0009";
    console.log("=".repeat(80));
    console.log("🔍 DEBUG: KTK DIREKTUR KONTRAKTOR BUG - ULOK", targetUlok);
    console.log("=".repeat(80));
    console.log("Timestamp:", new Date().toISOString());
    console.log();

    const report = {
        ulok: targetUlok,
        timestamp: new Date().toISOString(),
        toko: null,
        all_opname: [],
        ktk_pending: [],
        dir_kon_users: [],
        company_matching: [],
        users_without_pt: [],
        kontraktor_list: [],
        api_simulation: [],
        diagnosis: []
    };

    try {
        // 1. Check Toko
        console.log("[1/8] Checking Toko Data...");
        const tokoResult = await pool.query(
            `SELECT t.id, t.nomor_ulok, t.nama_toko, t.cabang, t.nama_kontraktor, t.proyek
             FROM toko t WHERE t.nomor_ulok = $1`,
            [targetUlok]
        );

        if (tokoResult.rows.length === 0) {
            console.error(`❌ ULOK ${targetUlok} not found!`);
            return;
        }

        report.toko = tokoResult.rows[0];
        console.log(`✓ Toko: ${report.toko.nama_toko}`);
        console.log(`  Kontraktor: ${report.toko.nama_kontraktor}`);
        console.log(`  Cabang: ${report.toko.cabang}\n`);

        // 2. All OPNAME_FINAL
        console.log("[2/8] Checking All OPNAME_FINAL...");
        const opnameResult = await pool.query(
            `SELECT ofn.id, ofn.status_opname_final, ofn.aksi, ofn.tipe_opname, 
                    ofn.grand_total_final, ofn.created_at,
                    t.nomor_ulok, t.nama_toko, t.cabang, t.nama_kontraktor
             FROM opname_final ofn
             JOIN toko t ON t.id = ofn.id_toko
             WHERE t.nomor_ulok = $1
             ORDER BY ofn.created_at DESC`,
            [targetUlok]
        );

        report.all_opname = opnameResult.rows;
        console.log(`✓ Found ${report.all_opname.length} OPNAME_FINAL record(s)`);
        report.all_opname.forEach((op, i) => {
            console.log(`  [${i+1}] ID: ${op.id}, Status: ${op.status_opname_final}, Aksi: ${op.aksi}`);
        });
        console.log();

        // 3. KTK Pending Direktur Kontraktor
        console.log("[3/8] Checking KTK Pending Direktur Kontraktor...");
        const ktkResult = await pool.query(
            `SELECT ofn.id, ofn.status_opname_final, ofn.aksi, ofn.tipe_opname,
                    t.nomor_ulok, t.nama_toko, t.cabang, t.nama_kontraktor,
                    ofn.grand_total_final, ofn.created_at
             FROM opname_final ofn
             JOIN toko t ON t.id = ofn.id_toko
             WHERE t.nama_kontraktor = $1
             AND ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
             AND ofn.aksi = 'terkunci'
             AND ofn.tipe_opname = 'OPNAME_FINAL'
             ORDER BY ofn.created_at DESC`,
            [report.toko.nama_kontraktor]
        );

        report.ktk_pending = ktkResult.rows;
        if (report.ktk_pending.length === 0) {
            console.log(`⚠️  NO KTK pending for: ${report.toko.nama_kontraktor}`);
            report.diagnosis.push("❌ ROOT CAUSE #1: Tidak ada KTK dengan status 'Menunggu Persetujuan Direktur Kontraktor'");
        } else {
            console.log(`✓ Found ${report.ktk_pending.length} KTK pending`);
            report.ktk_pending.forEach((ktk, i) => {
                console.log(`  [${i+1}] ULOK: ${ktk.nomor_ulok}, Total: Rp ${ktk.grand_total_final || 0}`);
            });
        }
        console.log();

        // 4. User Direktur Kontraktor
        console.log("[4/8] Checking User Direktur Kontraktor...");
        const usersResult = await pool.query(
            `SELECT uc.id, uc.email, uc.nama_lengkap, uc.jabatan, uc.cabang, uc.nama_pt, uc.roles
             FROM user_cabang uc
             WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
             ORDER BY uc.created_at DESC`
        );

        report.dir_kon_users = usersResult.rows;
        console.log(`✓ Found ${report.dir_kon_users.length} Direktur Kontraktor user(s)`);
        report.dir_kon_users.forEach((user, i) => {
            const ptStatus = user.nama_pt ? `PT: ${user.nama_pt}` : "🚨 MISSING nama_pt!";
            console.log(`  [${i+1}] ${user.email} - ${ptStatus}`);
        });
        console.log();

        // 5. Company Matching
        console.log("[5/8] Checking Company Name Matching...");
        const matchingResult = await pool.query(
            `SELECT uc.email, uc.nama_lengkap, uc.nama_pt AS user_company,
                    t.nomor_ulok, t.nama_toko, t.nama_kontraktor AS toko_company,
                    UPPER(REGEXP_REPLACE(uc.nama_pt, '[^A-Z0-9]', '', 'g')) AS user_normalized,
                    UPPER(REGEXP_REPLACE(t.nama_kontraktor, '[^A-Z0-9]', '', 'g')) AS toko_normalized,
                    CASE 
                        WHEN UPPER(REGEXP_REPLACE(uc.nama_pt, '[^A-Z0-9]', '', 'g')) = 
                             UPPER(REGEXP_REPLACE(t.nama_kontraktor, '[^A-Z0-9]', '', 'g'))
                        THEN 'MATCH ✓'
                        ELSE 'MISMATCH ✗'
                    END AS match_status
             FROM user_cabang uc
             CROSS JOIN toko t
             WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
             AND t.nomor_ulok = $1
             AND uc.nama_pt IS NOT NULL
             ORDER BY match_status, uc.created_at DESC`,
            [targetUlok]
        );

        report.company_matching = matchingResult.rows;
        const matchCount = report.company_matching.filter(r => r.match_status === "MATCH ✓").length;
        const mismatchCount = report.company_matching.filter(r => r.match_status === "MISMATCH ✗").length;

        console.log(`✓ Company Matching Results:`);
        console.log(`  ✓ MATCH: ${matchCount} user(s)`);
        console.log(`  ✗ MISMATCH: ${mismatchCount} user(s)`);

        if (matchCount === 0) {
            console.log(`\n  🚨 CRITICAL: Tidak ada user yang match!`);
            console.log(`     Toko: ${report.toko.nama_kontraktor}`);
            console.log(`     Normalized: ${normalizeCompanyName(report.toko.nama_kontraktor)}`);
            report.diagnosis.push("❌ ROOT CAUSE #2: Tidak ada user direktur kontraktor yang nama_pt-nya MATCH");
        }

        report.company_matching.forEach((match, i) => {
            const icon = match.match_status === "MATCH ✓" ? "✓" : "✗";
            console.log(`  ${icon} [${i+1}] ${match.email}`);
            console.log(`      User: ${match.user_company} → ${match.user_normalized}`);
            console.log(`      Toko: ${match.toko_company} → ${match.toko_normalized}`);
        });
        console.log();

        // 6. Users Without PT
        console.log("[6/8] Checking Users WITHOUT nama_pt...");
        const missingPTResult = await pool.query(
            `SELECT uc.id, uc.email, uc.nama_lengkap, uc.jabatan, uc.cabang, uc.nama_pt
             FROM user_cabang uc
             WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
             AND (uc.nama_pt IS NULL OR TRIM(uc.nama_pt) = '')
             ORDER BY uc.created_at DESC`
        );

        report.users_without_pt = missingPTResult.rows;
        if (report.users_without_pt.length > 0) {
            console.log(`🚨 CRITICAL: ${report.users_without_pt.length} user(s) WITHOUT nama_pt!`);
            report.users_without_pt.forEach((user, i) => {
                console.log(`  [${i+1}] ${user.email} - ${user.nama_lengkap}`);
            });
            report.diagnosis.push(`❌ ROOT CAUSE #3: ${report.users_without_pt.length} user tanpa nama_pt`);
        } else {
            console.log(`✓ All users have nama_pt`);
        }
        console.log();

        // 7. Kontraktor List
        console.log("[7/8] Listing Kontraktor with Pending KTK...");
        const kontraktorResult = await pool.query(
            `SELECT DISTINCT
                t.nama_kontraktor,
                t.cabang,
                COUNT(DISTINCT t.nomor_ulok) AS total_ulok,
                COUNT(DISTINCT ofn.id) FILTER (
                    WHERE ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
                    AND ofn.aksi = 'terkunci'
                ) AS ktk_pending_count
             FROM toko t
             LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
             WHERE t.nama_kontraktor IS NOT NULL AND TRIM(t.nama_kontraktor) != ''
             GROUP BY t.nama_kontraktor, t.cabang
             HAVING COUNT(DISTINCT ofn.id) FILTER (
                WHERE ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
                AND ofn.aksi = 'terkunci'
             ) > 0
             ORDER BY ktk_pending_count DESC, total_ulok DESC
             LIMIT 20`
        );

        report.kontraktor_list = kontraktorResult.rows;
        console.log(`✓ Found ${report.kontraktor_list.length} kontraktor(s) with pending KTK`);
        report.kontraktor_list.forEach((k, i) => {
            console.log(`  [${i+1}] ${k.nama_kontraktor} (${k.cabang}): ${k.ktk_pending_count} KTK`);
        });
        console.log();

        // 8. API Simulation
        console.log("[8/8] Simulating Frontend API Call...");
        const apiResult = await pool.query(
            `SELECT ofn.id, ofn.id_toko, ofn.status_opname_final, ofn.aksi, ofn.tipe_opname,
                    ofn.grand_total_final, ofn.email_pembuat, ofn.created_at,
                    t.nomor_ulok, t.nama_toko, t.cabang, t.nama_kontraktor,
                    UPPER(REGEXP_REPLACE(t.nama_kontraktor, '[^A-Z0-9]', '', 'g')) AS nama_kontraktor_normalized
             FROM opname_final ofn
             JOIN toko t ON t.id = ofn.id_toko
             WHERE ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
             AND ofn.aksi = 'terkunci'
             AND ofn.tipe_opname = 'OPNAME_FINAL'
             AND t.nomor_ulok = $1
             ORDER BY ofn.created_at DESC`,
            [targetUlok]
        );

        report.api_simulation = apiResult.rows;
        console.log(`✓ API Result: ${report.api_simulation.length} record(s)`);
        if (report.api_simulation.length === 0) {
            console.log(`  ⚠️  No data - Frontend akan kosong!`);
            report.diagnosis.push("❌ ROOT CAUSE #4: API tidak mengembalikan data untuk ULOK ini");
        } else {
            report.api_simulation.forEach((item, i) => {
                console.log(`  [${i+1}] ID: ${item.id}, ULOK: ${item.nomor_ulok}`);
            });
        }

        // DIAGNOSIS
        console.log("\n" + "=".repeat(80));
        console.log("🔍 DIAGNOSIS & ROOT CAUSE");
        console.log("=".repeat(80));

        if (report.diagnosis.length === 0) {
            report.diagnosis.push("⚠️  Data validation passed, but frontend still not showing?");
            report.diagnosis.push("   → Kemungkinan besar: Frontend TIDAK fetch data OPNAME");
            report.diagnosis.push("   → File: sparta-fe/app/approval/page.tsx");
            report.diagnosis.push("   → Missing: fetchOpnameFinalList() call");
        }

        report.diagnosis.forEach(line => console.log(line));

        // Save Report
        const reportPath = path.join(__dirname, `../DEBUG-KTK-${targetUlok}-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n✓ Report saved: ${reportPath}`);

        console.log("\n" + "=".repeat(80));
        console.log("✅ DEBUG COMPLETED");
        console.log("=".repeat(80));

    } catch (error) {
        console.error("\n❌ ERROR:", error);
    } finally {
        await pool.end();
    }
};

debugKTK().catch(console.error);
