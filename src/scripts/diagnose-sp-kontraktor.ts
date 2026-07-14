/**
 * Diagnose Script: SP Kontraktor Issue
 * 
 * Purpose: Check why kontraktor from user_cabang not showing
 * Run: npx ts-node src/scripts/diagnose-sp-kontraktor.ts
 */

import { pool } from '../db/pool';
import { spRepository } from '../modules/surat-peringatan/sp.repository';
import { getEffectiveBranchesForUser } from '../common/branch-scope';
import type { AuthenticatedUser } from '../modules/auth/auth-session.service';

async function diagnose() {
    console.log('🔍 DIAGNOSE: SP Kontraktor Issue\n');
    console.log('='.repeat(70));

    try {
        // 1. Check total kontraktor users in user_cabang
        console.log('\n📊 Step 1: Total Kontraktor Users in user_cabang\n');
        
        const totalQuery = await pool.query(`
            SELECT 
                COUNT(*) AS total,
                COUNT(DISTINCT cabang) AS total_cabang
            FROM user_cabang
            WHERE UPPER(TRIM(role)) = 'KONTRAKTOR'
              AND NULLIF(TRIM(jabatan), '') IS NOT NULL
        `);
        
        console.log(`  Total kontraktor users: ${totalQuery.rows[0].total}`);
        console.log(`  Total branches: ${totalQuery.rows[0].total_cabang}`);

        // 2. List all kontraktor users
        console.log('\n📋 Step 2: List All Kontraktor Users\n');
        
        const allKontraktor = await pool.query(`
            SELECT 
                id,
                email_sat,
                nama,
                TRIM(jabatan) AS nama_kontraktor,
                UPPER(TRIM(cabang)) AS cabang,
                UPPER(TRIM(role)) AS role
            FROM user_cabang
            WHERE UPPER(TRIM(role)) = 'KONTRAKTOR'
              AND NULLIF(TRIM(jabatan), '') IS NOT NULL
            ORDER BY cabang, nama_kontraktor
        `);
        
        if (allKontraktor.rows.length === 0) {
            console.log('  ❌ NO KONTRAKTOR USERS FOUND!');
            console.log('  This is why the query returns empty.');
        } else {
            console.log(`  Found ${allKontraktor.rows.length} kontraktor users:`);
            allKontraktor.rows.forEach((row, idx) => {
                console.log(`    ${idx + 1}. ${row.nama_kontraktor} (${row.cabang}) - ${row.email_sat}`);
            });
        }

        // 3. Check BALI specifically
        console.log('\n🏝️  Step 3: BALI Kontraktor Users\n');
        
        const baliKontraktor = await pool.query(`
            SELECT 
                id,
                email_sat,
                nama,
                TRIM(jabatan) AS nama_kontraktor,
                cabang AS cabang_raw,
                UPPER(TRIM(cabang)) AS cabang_normalized,
                role AS role_raw,
                UPPER(TRIM(role)) AS role_normalized
            FROM user_cabang
            WHERE UPPER(TRIM(cabang)) = 'BALI'
            ORDER BY role, nama
        `);
        
        console.log(`  Total users in BALI: ${baliKontraktor.rows.length}`);
        
        if (baliKontraktor.rows.length === 0) {
            console.log('  ❌ NO USERS FOUND FOR BALI BRANCH!');
        } else {
            baliKontraktor.rows.forEach((row, idx) => {
                const isKontraktor = row.role_normalized === 'KONTRAKTOR';
                const hasJabatan = row.nama_kontraktor && row.nama_kontraktor.trim() !== '';
                console.log(`    ${idx + 1}. ${row.nama} (${row.email_sat})`);
                console.log(`       Role: "${row.role_raw}" → normalized: "${row.role_normalized}" ${isKontraktor ? '✅' : '❌'}`);
                console.log(`       Jabatan: "${row.nama_kontraktor}" ${hasJabatan ? '✅' : '❌'}`);
                console.log(`       Cabang: "${row.cabang_raw}" → normalized: "${row.cabang_normalized}"`);
            });
        }

        // 4. Check distinct roles
        console.log('\n📌 Step 4: All Distinct Roles in user_cabang\n');
        
        const roles = await pool.query(`
            SELECT DISTINCT 
                role AS role_raw,
                UPPER(TRIM(role)) AS role_normalized,
                COUNT(*) AS jumlah
            FROM user_cabang
            GROUP BY role
            ORDER BY role
        `);
        
        console.log(`  Found ${roles.rows.length} distinct roles:`);
        roles.rows.forEach((row, idx) => {
            console.log(`    ${idx + 1}. "${row.role_raw}" → "${row.role_normalized}" (${row.jumlah} users)`);
        });

        // 5. Test repository method
        console.log('\n🧪 Step 5: Test Repository Method (BALI User)\n');
        
        const mockBaliUser: AuthenticatedUser = {
            email_sat: '',
            cabang: 'BALI',alfan.hidayatullah@sat.co.id
            roles: ['KOORDINATOR'],
            isHO: false,
            isManager: false
        } as AuthenticatedUser;

        const scope = await getEffectiveBranchesForUser({
            emailSat: mockBaliUser.email_sat,
            cabang: mockBaliUser.cabang,
            roles: mockBaliUser.roles
        });

        console.log(`  Branch scope for BALI user:`);
        console.log(`    Source: ${scope.source}`);
        console.log(`    Branches: [${scope.branches.join(', ')}]`);

        const fromProjects = await spRepository.listKontraktor(mockBaliUser);
        console.log(`\n  Kontraktor from projects: ${fromProjects.length}`);
        fromProjects.forEach((k, idx) => {
            console.log(`    ${idx + 1}. ${k}`);
        });

        const fromUsers = await spRepository.listKontraktorFromUserCabang(mockBaliUser);
        console.log(`\n  Kontraktor from user_cabang: ${fromUsers.length}`);
        if (fromUsers.length === 0) {
            console.log(`    ❌ EMPTY! This is the problem.`);
        } else {
            fromUsers.forEach((k, idx) => {
                console.log(`    ${idx + 1}. ${k}`);
            });
        }

        // 6. Sample data from user_cabang
        console.log('\n📄 Step 6: Sample Data from user_cabang (first 5 rows)\n');
        
        const sample = await pool.query(`
            SELECT 
                id,
                email_sat,
                nama,
                jabatan,
                cabang,
                role
            FROM user_cabang
            ORDER BY id
            LIMIT 5
        `);
        
        if (sample.rows.length === 0) {
            console.log('  ❌ TABLE IS EMPTY!');
        } else {
            sample.rows.forEach((row, idx) => {
                console.log(`    ${idx + 1}. ID: ${row.id}`);
                console.log(`       Email: ${row.email_sat}`);
                console.log(`       Nama: ${row.nama}`);
                console.log(`       Jabatan: "${row.jabatan}"`);
                console.log(`       Cabang: "${row.cabang}"`);
                console.log(`       Role: "${row.role}"`);
                console.log('');
            });
        }

        // 7. Final analysis
        console.log('\n' + '='.repeat(70));
        console.log('\n📝 ANALYSIS & RECOMMENDATIONS\n');

        if (totalQuery.rows[0].total === '0') {
            console.log('  ❌ PROBLEM: No kontraktor users in user_cabang table');
            console.log('  ✅ SOLUTION: Add kontraktor users to user_cabang with:');
            console.log('     - role = "KONTRAKTOR" (exact match, case-insensitive)');
            console.log('     - jabatan = contractor company name');
            console.log('     - cabang = branch name (e.g., "BALI")');
        } else if (baliKontraktor.rows.length === 0) {
            console.log('  ❌ PROBLEM: No users found for BALI branch');
            console.log('  ✅ SOLUTION: Check cabang field spelling');
        } else if (fromUsers.length === 0) {
            console.log('  ❌ PROBLEM: Query filters too strict or field mismatch');
            console.log('  ✅ SOLUTION: Check the query conditions in listKontraktorFromUserCabang()');
        } else {
            console.log('  ✅ Data exists and query should work');
            console.log('  ⚠️  If still not showing, check:');
            console.log('     1. Build & deployment completed successfully');
            console.log('     2. Server restarted after deployment');
            console.log('     3. Browser cache cleared');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n❌ Error during diagnosis:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run diagnosis
diagnose()
    .then(() => {
        console.log('\n✅ Diagnosis completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Diagnosis failed:', error);
        process.exit(1);
    });
