/**
 * Verification Script: SP Kontraktor Fix
 * 
 * Purpose: Verify that the listKontraktor() fix includes user_cabang table
 * Date: 2026-07-14
 * 
 * Run: npx ts-node scripts/verify-sp-kontraktor-fix.ts
 */

import { pool } from '../src/db/pool';
import { spRepository } from '../src/modules/surat-peringatan/sp.repository';
import type { AuthenticatedUser } from '../src/modules/auth/auth-session.service';

interface KontraktorBySource {
    nama_kontraktor: string;
    source: string;
    cabang: string;
}

async function verifyKontraktorFix() {
    console.log('🔍 SP Kontraktor Fix Verification\n');
    console.log('=' .repeat(60));

    try {
        // 1. Check kontraktor from each source
        console.log('\n📊 Step 1: Check kontraktor by source\n');

        const sourceQueries = [
            {
                name: 'pengajuan_spk',
                query: `
                    SELECT DISTINCT 
                        TRIM(ps.nama_kontraktor) AS nama_kontraktor,
                        'pengajuan_spk' AS source,
                        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
                    FROM pengajuan_spk ps
                    LEFT JOIN toko t ON t.id = ps.id_toko
                    WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL
                      AND UPPER(TRIM(ps.nama_kontraktor)) <> 'HEAD OFFICE'
                    ORDER BY cabang, nama_kontraktor
                `
            },
            {
                name: 'toko',
                query: `
                    SELECT DISTINCT 
                        TRIM(t.nama_kontraktor) AS nama_kontraktor,
                        'toko' AS source,
                        UPPER(TRIM(COALESCE(t.cabang, 'UNKNOWN'))) AS cabang
                    FROM toko t
                    WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL
                      AND UPPER(TRIM(t.nama_kontraktor)) <> 'HEAD OFFICE'
                    ORDER BY cabang, nama_kontraktor
                `
            },
            {
                name: 'user_cabang',
                query: `
                    SELECT DISTINCT 
                        TRIM(uc.jabatan) AS nama_kontraktor,
                        'user_cabang' AS source,
                        UPPER(TRIM(COALESCE(uc.cabang, 'UNKNOWN'))) AS cabang
                    FROM user_cabang uc
                    WHERE UPPER(TRIM(uc.role)) = 'KONTRAKTOR'
                      AND NULLIF(TRIM(uc.jabatan), '') IS NOT NULL
                      AND UPPER(TRIM(uc.jabatan)) <> 'HEAD OFFICE'
                    ORDER BY cabang, nama_kontraktor
                `
            }
        ];

        for (const { name, query } of sourceQueries) {
            const result = await pool.query<KontraktorBySource>(query);
            console.log(`  ${name}: ${result.rows.length} contractors`);
            
            // Group by cabang
            const byCabang: Record<string, number> = {};
            result.rows.forEach(row => {
                byCabang[row.cabang] = (byCabang[row.cabang] || 0) + 1;
            });
            
            Object.entries(byCabang).forEach(([cabang, count]) => {
                console.log(`    - ${cabang}: ${count}`);
            });
        }

        // 2. Check BALI specifically
        console.log('\n📍 Step 2: BALI Contractors Detail\n');

        const baliQuery = `
            SELECT DISTINCT nama_kontraktor, source
            FROM (
                SELECT DISTINCT 
                    TRIM(ps.nama_kontraktor) AS nama_kontraktor,
                    'pengajuan_spk' AS source
                FROM pengajuan_spk ps
                LEFT JOIN toko t ON t.id = ps.id_toko
                WHERE NULLIF(TRIM(ps.nama_kontraktor), '') IS NOT NULL
                  AND UPPER(TRIM(COALESCE(t.cabang, ''))) = 'BALI'
                
                UNION
                
                SELECT DISTINCT 
                    TRIM(t.nama_kontraktor) AS nama_kontraktor,
                    'toko' AS source
                FROM toko t
                WHERE NULLIF(TRIM(t.nama_kontraktor), '') IS NOT NULL
                  AND UPPER(TRIM(COALESCE(t.cabang, ''))) = 'BALI'
                
                UNION
                
                SELECT DISTINCT 
                    TRIM(uc.jabatan) AS nama_kontraktor,
                    'user_cabang' AS source
                FROM user_cabang uc
                WHERE UPPER(TRIM(uc.role)) = 'KONTRAKTOR'
                  AND NULLIF(TRIM(uc.jabatan), '') IS NOT NULL
                  AND UPPER(TRIM(COALESCE(uc.cabang, ''))) = 'BALI'
            ) AS combined
            WHERE UPPER(TRIM(nama_kontraktor)) <> 'HEAD OFFICE'
            ORDER BY nama_kontraktor
        `;

        const baliResult = await pool.query<KontraktorBySource>(baliQuery);
        console.log(`  Total BALI contractors: ${baliResult.rows.length}`);
        
        baliResult.rows.forEach((row, idx) => {
            console.log(`    ${idx + 1}. ${row.nama_kontraktor} (from ${row.source})`);
        });

        // 3. Test repository method with mock BALI user
        console.log('\n🧪 Step 3: Test Repository Method (BALI User)\n');

        const mockBaliUser: AuthenticatedUser = {
            email_sat: 'koordinator.bali@test.com',
            cabang: 'BALI',
            roles: ['KOORDINATOR'],
            nama: 'Test Koordinator BALI',
            isHO: false,
            isManager: false
        };

        const repoResult = await spRepository.listKontraktor(mockBaliUser);
        console.log(`  Repository returned: ${repoResult.length} contractors`);
        
        repoResult.forEach((kontraktor, idx) => {
            console.log(`    ${idx + 1}. ${kontraktor}`);
        });

        // 4. Compare SQL vs Repository
        console.log('\n📊 Step 4: Comparison\n');

        const sqlOnly = baliResult.rows.map(r => r.nama_kontraktor).sort();
        const repoOnly = repoResult.sort();

        const missing = sqlOnly.filter(k => !repoOnly.includes(k));
        const extra = repoOnly.filter(k => !sqlOnly.includes(k));

        console.log(`  SQL Query: ${sqlOnly.length} contractors`);
        console.log(`  Repository: ${repoOnly.length} contractors`);
        
        if (missing.length > 0) {
            console.log(`  ❌ Missing in Repository: ${missing.join(', ')}`);
        }
        
        if (extra.length > 0) {
            console.log(`  ⚠️  Extra in Repository: ${extra.join(', ')}`);
        }
        
        if (missing.length === 0 && extra.length === 0) {
            console.log(`  ✅ Perfect match!`);
        }

        // 5. Check user_cabang table structure
        console.log('\n🔍 Step 5: Verify user_cabang Table\n');

        const userCabangCheck = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE UPPER(TRIM(role)) = 'KONTRAKTOR') AS kontraktor_count,
                COUNT(*) FILTER (WHERE UPPER(TRIM(role)) = 'KONTRAKTOR' AND UPPER(TRIM(cabang)) = 'BALI') AS bali_kontraktor_count,
                COUNT(DISTINCT cabang) FILTER (WHERE UPPER(TRIM(role)) = 'KONTRAKTOR') AS branches_with_kontraktor
            FROM user_cabang
            WHERE NULLIF(TRIM(jabatan), '') IS NOT NULL
        `);

        const stats = userCabangCheck.rows[0];
        console.log(`  Total kontraktor users: ${stats.kontraktor_count}`);
        console.log(`  BALI kontraktor users: ${stats.bali_kontraktor_count}`);
        console.log(`  Branches with kontraktor: ${stats.branches_with_kontraktor}`);

        // 6. Final verdict
        console.log('\n' + '='.repeat(60));
        console.log('\n✅ VERIFICATION COMPLETE\n');

        if (baliResult.rows.length >= 4) {
            console.log('  ✅ BALI has 4+ contractors (GOOD)');
        } else {
            console.log(`  ⚠️  BALI has only ${baliResult.rows.length} contractors (expected 4+)`);
        }

        if (stats.bali_kontraktor_count > 0) {
            console.log(`  ✅ user_cabang has ${stats.bali_kontraktor_count} BALI kontraktor users`);
        } else {
            console.log('  ⚠️  No BALI kontraktor users in user_cabang table');
        }

        if (repoResult.length === baliResult.rows.length) {
            console.log('  ✅ Repository returns correct count');
        } else {
            console.log(`  ❌ Repository count mismatch: ${repoResult.length} vs ${baliResult.rows.length}`);
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error during verification:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run verification
verifyKontraktorFix()
    .then(() => {
        console.log('\n✅ Verification script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Verification script failed:', error);
        process.exit(1);
    });
