/**
 * DEBUG SCRIPT: Investigasi KTK Direktur Kontraktor Bug
 * 
 * Purpose: Mencari penyebab mengapa direktur kontraktor tidak bisa melihat KTK pending
 * Focus: ULOK 2SZ1-2508-0009 sebagai test case
 * 
 * Run: npm run ts-node src/scripts/debug-ktk-direktur-kontraktor.ts
 */

import { pool } from "../config/database";
import * as fs from "fs";
import * as path from "path";

interface TokoData {
    toko_id: number;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    nama_kontraktor: string;
    proyek: string;
}

interface OpnameFinalData {
    opname_id: number;
    id_toko: number;
    status_opname_final: string;
    aksi: string;
    tipe_opname: string;
    email_pembuat: string;
    grand_total_final: string | null;
    created_at: Date;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    nama_kontraktor: string;
}

interface UserDirConData {
    user_id: number;
    email: string;
    nama_lengkap: string;
    jabatan: string;
    cabang: string;
    nama_pt: string | null;
    roles: string;
}

interface CompanyMatchData {
    user_email: string;
    user_name: string;
    user_company: string | null;
    nomor_ulok: string;
    nama_toko: string;
    toko_company: string | null;
    user_normalized: string;
    toko_normalized: string;
    match_status: string;
}

const normalizeCompanyName = (name: string | null): string => {
    if (!name) return "";
    return name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/^(PT|CV)/g, "")
        .replace(/(PT|CV)$/g, "")
        .trim();
};

const debugKTKDirektorKontraktor = async (targetUlok: string = "2SZ1-2508-0009") => {
    console.log("=".repeat(80));
    console.log("DEBUG: KTK DIREKTUR KONTRAKTOR BUG INVESTIGATION");
    console.log("=".repeat(80));
    console.log(`Target ULOK: ${targetUlok}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log("=".repeat(80));
    console.log();

    const report: string[] = [];
    const addToReport = (section: string, data: any) => {
        report.push(`\n## ${section}\n`);
        report.push("```json");
        report.push(JSON.stringify(data, null, 2));
        report.push("```\n");
    };

    try {
        // ============================================================
        // 1. CHECK TOKO DATA
        // ============================================================
        console.log("📋 [1/8] Checking Toko Data...");
        const tokoResult = await pool.query<TokoData>(
            `SELECT 
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.nama_kontraktor,
                t.proyek
            FROM toko t
            WHERE t.nomor_ulok = $1`,
            [targetUlok]
        );

        if (tokoResult.rows.length === 0) {
            console.error(`❌ ERROR: ULOK ${targetUlok} tidak ditemukan di database!`);
            process.exit(1);
        }

        const tokoData = tokoResult.rows[0];
        console.log(`✓ Found Toko: ${tokoData.nama_toko}`);
        console.log(`  Kontraktor: ${tokoData.nama_kontraktor}`);
        console.log(`  Cabang: ${tokoData.cabang}`);
        addToReport("1. Toko Data", tokoData);

        // ============================================================
        // 2. CHECK ALL OPNAME_FINAL FOR THIS ULOK
        // ============================================================
        console.log("\n📋 [2/8] Checking All OPNAME_FINAL Records...");
        const allOpnameResult = await pool.query<OpnameFinalData>(
            `SELECT 
                ofn.id AS opname_id,
                ofn.id_toko,
                ofn.status_opname_final,
                ofn.aksi,
                ofn.tipe_opname,
                ofn.email_pembuat,
                ofn.grand_total_final,
                ofn.created_at,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.nama_kontraktor
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE t.nomor_ulok = $1
            ORDER BY ofn.created_at DESC`,
            [targetUlok]
        );

        console.log(`✓ Found ${allOpnameResult.rows.length} OPNAME_FINAL record(s)`);
        allOpnameResult.rows.forEach((opname, idx) => {
            console.log(`  [${idx + 1}] ID: ${opname.opname_id}, Status: ${opname.status_opname_final}, Aksi: ${opname.aksi}`);
        });
        addToReport("2. All OPNAME_FINAL Records", allOpnameResult.rows);

        // ============================================================
        // 3. CHECK KTK PENDING DIREKTUR KONTRAKTOR
        // ============================================================
        console.log("\n📋 [3/8] Checking KTK Pending Direktur Kontraktor...");
        const pendingKTKResult = await pool.query<OpnameFinalData>(
            `SELECT 
                ofn.id AS opname_id,
                ofn.status_opname_final,
                ofn.aksi,
                ofn.tipe_opname,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.nama_kontraktor,
                ofn.grand_total_final,
                ofn.created_at
            FROM opname_final ofn
            JOIN toko t ON t.id = ofn.id_toko
            WHERE t.nama_kontraktor = $1
            AND ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
            AND ofn.aksi = 'terkunci'
            AND ofn.tipe_opname = 'OPNAME_FINAL'
            ORDER BY ofn.created_at DESC`,
            [tokoData.nama_kontraktor]
        );

        if (pendingKTKResult.rows.length === 0) {
            console.log(`⚠️  NO KTK pending direktur kontraktor for: ${tokoData.nama_kontraktor}`);
            console.log(`   → Kemungkinan: Status sudah berubah atau belum ada KTK yang dikunci`);
        } else {
            console.log(`✓ Found ${pendingKTKResult.rows.length} KTK pending direktur kontraktor`);
            pendingKTKResult.rows.forEach((ktk, idx) => {
                console.log(`  [${idx + 1}] ULOK: ${ktk.nomor_ulok}, Total: ${ktk.grand_total_final || "N/A"}`);
            });
        }
        addToReport("3. KTK Pending Direktur Kontraktor", pendingKTKResult.rows);

        // ============================================================
        // 4. CHECK USER DIREKTUR KONTRAKTOR
        // ============================================================
        console.log("\n📋 [4/8] Checking User Direktur Kontraktor...");
        const allDirConResult = await pool.query<UserDirConData>(
            `SELECT 
                uc.id AS user_id,
                uc.email,
                uc.nama_lengkap,
                uc.jabatan,
                uc.cabang,
                uc.nama_pt,
                uc.roles
            FROM user_cabang uc
            WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
            ORDER BY uc.created_at DESC`
        );

        console.log(`✓ Found ${allDirConResult.rows.length} Direktur Kontraktor user(s)`);
        allDirConResult.rows.forEach((user, idx) => {
            const ptStatus = user.nama_pt ? `PT: ${user.nama_pt}` : "🚨 MISSING nama_pt!";
            console.log(`  [${idx + 1}] ${user.email} - ${ptStatus}`);
        });
        addToReport("4. All Direktur Kontraktor Users", allDirConResult.rows);

        // ============================================================
        // 5. CHECK COMPANY NAME MATCHING
        // ============================================================
        console.log("\n📋 [5/8] Checking Company Name Matching...");
        const matchingResult = await pool.query<CompanyMatchData>(
            `SELECT 
                uc.email AS user_email,
                uc.nama_lengkap AS user_name,
                uc.nama_pt AS user_company,
                t.nomor_ulok,
                t.nama_toko,
                t.nama_kontraktor AS toko_company,
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

        const matchCount = matchingResult.rows.filter(r => r.match_status === "MATCH ✓").length;
        const mismatchCount = matchingResult.rows.filter(r => r.match_status === "MISMATCH ✗").length;

        console.log(`✓ Company Matching Results:`);
        console.log(`  ✓ MATCH: ${matchCount} user(s)`);
        console.log(`  ✗ MISMATCH: ${mismatchCount} user(s)`);

        if (matchCount === 0) {
            console.log(`\n  🚨 CRITICAL: Tidak ada user direktur kontraktor yang match dengan kontraktor ULOK ini!`);
            console.log(`     Toko Company: ${tokoData.nama_kontraktor}`);
            console.log(`     Normalized: ${normalizeCompanyName(tokoData.nama_kontraktor)}`);
        }

        matchingResult.rows.forEach((match, idx) => {
            const icon = match.match_status === "MATCH ✓" ? "✓" : "✗";
            console.log(`  ${icon} [${idx + 1}] ${match.user_email}`);
            console.log(`      User PT: ${match.user_company} → ${match.user_normalized}`);
            console.log(`      Toko PT: ${match.toko_company} → ${match.toko_normalized}`);
        });
        addToReport("5. Company Name Matching", matchingResult.rows);

        // ============================================================
        // 6. CHECK USERS WITHOUT NAMA_PT
        // ============================================================
        console.log("\n📋 [6/8] Checking Users WITHOUT nama_pt...");
        const missingPTResult = await pool.query<UserDirConData>(
            `SELECT 
                uc.id AS user_id,
                uc.email,
                uc.nama_lengkap,
                uc.jabatan,
                uc.cabang,
                uc.nama_pt
            FROM user_cabang uc
            WHERE UPPER(uc.jabatan) LIKE '%DIREKTUR%KONTRAKTOR%'
            AND (uc.nama_pt IS NULL OR TRIM(uc.nama_pt) = '')
            ORDER BY uc.created_at DESC`
        );

        if (missingPTResult.rows.length > 0) {
            console.log(`🚨 CRITICAL: Found ${missingPTResult.rows.length} user(s) WITHOUT nama_pt!`);
            missingPTResult.rows.forEach((user, idx) => {
                console.log(`  [${idx + 1}] ${user.email} - ${user.nama_lengkap}`);
            });
            console.log(`  → Ini bisa jadi ROOT CAUSE bug! User ini tidak bisa akses approval sama sekali.`);
        } else {
            console.log(`✓ All direktur kontraktor users have nama_pt (Good!)`);
        }
        addToReport("6. Users WITHOUT nama_pt", missingPTResult.rows);

        // ============================================================
        // 7. LIST ALL KONTRAKTOR WITH PENDING KTK COUNT
        // ============================================================
        console.log("\n📋 [7/8] Listing All Kontraktor with Pending KTK...");
        const kontraktorListResult = await pool.query(
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
            WHERE t.nama_kontraktor IS NOT NULL
            AND TRIM(t.nama_kontraktor) != ''
            GROUP BY t.nama_kontraktor, t.cabang
            HAVING COUNT(DISTINCT ofn.id) FILTER (
                WHERE ofn.status_opname_final = 'Menunggu Persetujuan Direktur Kontraktor'
                AND ofn.aksi = 'terkunci'
            ) > 0
            ORDER BY ktk_pending_count DESC, total_ulok DESC
            LIMIT 20`
        );

        console.log(`✓ Found ${kontraktorListResult.rows.length} kontraktor(s) with pending KTK`);
        kontraktorListResult.rows.forEach((kontraktor: any, idx) => {
            console.log(`  [${idx + 1}] ${kontraktor.nama_kontraktor} (${kontraktor.cabang})`);
            console.log(`      Total ULOK: ${kontraktor.total_ulok}, Pending KTK: ${kontraktor.ktk_pending_count}`);
        });
        addToReport("7. Kontraktor List with Pending KTK", kontraktorListResult.rows);

        // ============================================================
        // 8. SIMULATE FRONTEND API CALL
        // ============================================================
        console.log("\n📋 [8/8] Simulating Frontend API Call...");
        const apiSimResult = await pool.query<OpnameFinalData>(
            `SELECT 
                ofn.id,
                ofn.id_toko,
                ofn.status_opname_final,
                ofn.aksi,
                ofn.tipe_opname,
                ofn.grand_total_final,
                ofn.email_pembuat,
                ofn.created_at,
                t.nomor_ulok,
                t.nama_toko,
                t.cabang,
                t.nama_kontraktor,
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

        console.log(`✓ API Simulation Result: ${apiSimResult.rows.length} record(s)`);
        if (apiSimResult.rows.length === 0) {
            console.log(`  ⚠️  No data returned - Frontend akan menampilkan "Tidak ada dokumen"`);
        } else {
            apiSimResult.rows.forEach((item, idx) => {
                console.log(`  [${idx + 1}] ID: ${item.id}, ULOK: ${item.nomor_ulok}`);
                console.log(`      Status: ${item.status_opname_final}`);
                console.log(`      Kontraktor: ${item.nama_kontraktor}`);
            });
        }
        addToReport("8. Frontend API Simulation", apiSimResult.rows);

        // ============================================================
        // DIAGNOSIS & RECOMMENDATIONS
        // ============================================================
        console.log("\n" + "=".repeat(80));
        console.log("🔍 DIAGNOSIS & ROOT CAUSE ANALYSIS");
        console.log("=".repeat(80));

        const diagnosis: string[] = [];

        // Check 1: Ada KTK pending?
        if (pendingKTKResult.rows.length === 0) {
            diagnosis.push("❌ ROOT CAUSE #1: Tidak ada KTK dengan status 'Menunggu Persetujuan Direktur Kontraktor'");
            diagnosis.push("   → Solusi: Cek apakah KTK sudah dikunci? Status saat ini mungkin masih 'Proses KTK/Approval Kontraktor'");
        } else {
            diagnosis.push("✓ Ada KTK pending direktur kontraktor");
        }

        // Check 2: Ada user direktur kontraktor?
        if (allDirConResult.rows.length === 0) {
            diagnosis.push("❌ ROOT CAUSE #2: Tidak ada user dengan jabatan 'Direktur Kontraktor' di database");
            diagnosis.push("   → Solusi: Buat user direktur kontraktor di tabel user_cabang");
        } else {
            diagnosis.push(`✓ Ada ${allDirConResult.rows.length} user direktur kontraktor`);
        }

        // Check 3: User punya nama_pt?
        if (missingPTResult.rows.length > 0) {
            diagnosis.push(`❌ ROOT CAUSE #3: Ada ${missingPTResult.rows.length} user direktur kontraktor TANPA nama_pt`);
            diagnosis.push("   → Solusi: Update user_cabang SET nama_pt = '[NAMA PT]' WHERE id IN (...)");
            diagnosis.push("   → CRITICAL: Backend akan reject request jika nama_pt NULL!");
        } else {
            diagnosis.push("✓ Semua user direktur kontraktor punya nama_pt");
        }

        // Check 4: Ada user yang match?
        if (matchCount === 0 && allDirConResult.rows.length > 0 && pendingKTKResult.rows.length > 0) {
            diagnosis.push("❌ ROOT CAUSE #4: Tidak ada user direktur kontraktor yang nama_pt-nya MATCH dengan nama_kontraktor toko");
            diagnosis.push(`   Toko Kontraktor: ${tokoData.nama_kontraktor}`);
            diagnosis.push(`   Normalized: ${normalizeCompanyName(tokoData.nama_kontraktor)}`);
            diagnosis.push("   → Solusi: Update nama_pt user ATAU nama_kontraktor toko agar match");
            diagnosis.push("   → Frontend filter akan EXCLUDE dokumen ini karena company tidak match");
        } else if (matchCount > 0) {
            diagnosis.push(`✓ Ada ${matchCount} user yang company-nya match`);
        }

        // Check 5: Frontend fetch issue
        diagnosis.push("\n⚠️  POTENTIAL ROOT CAUSE #5: Frontend TIDAK fetch data OPNAME");
        diagnosis.push("   → File: sparta-fe/app/approval/page.tsx");
        diagnosis.push("   → Missing: fetchOpnameFinalList() call dengan filter status");
        diagnosis.push("   → Solusi: Tambahkan fetch logic seperti di ANALISIS-BUG-DIREKTUR-KONTRAKTOR-KTK.md");

        diagnosis.forEach(line => console.log(line));
        report.push("\n## DIAGNOSIS\n");
        report.push(diagnosis.join("\n"));

        // ============================================================
        // SAVE REPORT
        // ============================================================
        const reportPath = path.join(__dirname, "../../../", `DEBUG-KTK-${targetUlok}-${Date.now()}.md`);
        const reportContent = [
            `# Debug Report: KTK Direktur Kontraktor`,
            `**ULOK**: ${targetUlok}`,
            `**Timestamp**: ${new Date().toISOString()}`,
            `**Toko**: ${tokoData.nama_toko}`,
            `**Kontraktor**: ${tokoData.nama_kontraktor}`,
            ``,
            ...report,
            `\n## Summary`,
            `- Total OPNAME_FINAL: ${allOpnameResult.rows.length}`,
            `- KTK Pending Dir.Kon: ${pendingKTKResult.rows.length}`,
            `- Total Dir.Kon Users: ${allDirConResult.rows.length}`,
            `- Users WITHOUT nama_pt: ${missingPTResult.rows.length}`,
            `- Company MATCH: ${matchCount}`,
            `- Company MISMATCH: ${mismatchCount}`,
        ].join("\n");

        fs.writeFileSync(reportPath, reportContent);
        console.log(`\n✓ Report saved to: ${reportPath}`);

        console.log("\n" + "=".repeat(80));
        console.log("DEBUG COMPLETED");
        console.log("=".repeat(80));

    } catch (error) {
        console.error("\n❌ ERROR during debug:", error);
        throw error;
    } finally {
        await pool.end();
    }
};

// Run the script
const targetUlok = process.argv[2] || "2SZ1-2508-0009";
debugKTKDirektorKontraktor(targetUlok).catch(console.error);
