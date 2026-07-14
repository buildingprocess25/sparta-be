/**
 * Script untuk verifikasi bahwa SEMUA data (lama & baru) sudah aligned
 * dengan logic cross-lingkup pertambahan SPK
 */

import { pool } from '../db/pool';

interface DataAlignmentResult {
    total_uloks_with_multiple_lingkup: number;
    uloks_with_pertambahan: number;
    correctly_aligned_uloks: number;
    misaligned_uloks: number;
    sample_correct_uloks: any[];
    sample_misaligned_uloks: any[];
}

async function verifyAllDataAlignment(): Promise<void> {
    console.log('========================================');
    console.log('VERIFIKASI DATA ALIGNMENT');
    console.log('Pertambahan SPK Cross-Lingkup');
    console.log('========================================\n');

    try {
        // 1. Check total ULOKs dengan multiple lingkup
        const totalUloksQuery = await pool.query(`
            SELECT COUNT(DISTINCT nomor_ulok) as count
            FROM toko
            WHERE nomor_ulok IN (
                SELECT nomor_ulok 
                FROM toko 
                GROUP BY nomor_ulok 
                HAVING COUNT(*) > 1
            )
        `);
        const totalUloks = parseInt(totalUloksQuery.rows[0]?.count || '0');

        console.log(`✅ Total ULOKs dengan multiple lingkup: ${totalUloks}`);

        // 2. Check ULOKs yang punya pertambahan SPK approved
        const uloksWithPertambahanQuery = await pool.query(`
            SELECT COUNT(DISTINCT t.nomor_ulok) as count
            FROM pertambahan_spk pt
            JOIN pengajuan_spk ps ON ps.id = pt.id_spk
            JOIN toko t ON t.id = ps.id_toko
            WHERE pt.status_persetujuan = 'Disetujui BM'
                AND t.nomor_ulok IN (
                    SELECT nomor_ulok 
                    FROM toko 
                    GROUP BY nomor_ulok 
                    HAVING COUNT(*) > 1
                )
        `);
        const uloksWithPertambahan = parseInt(uloksWithPertambahanQuery.rows[0]?.count || '0');

        console.log(`✅ ULOKs dengan pertambahan approved: ${uloksWithPertambahan}\n`);

        // 3. Check alignment: Semua lingkup dalam ULOK yang sama harus punya effective_end yang sama
        const alignmentCheckQuery = await pool.query(`
            WITH ulok_with_pertambahan AS (
                SELECT DISTINCT t.nomor_ulok
                FROM pertambahan_spk pt
                JOIN pengajuan_spk ps ON ps.id = pt.id_spk
                JOIN toko t ON t.id = ps.id_toko
                WHERE pt.status_persetujuan = 'Disetujui BM'
                    AND t.nomor_ulok IN (
                        SELECT nomor_ulok 
                        FROM toko 
                        GROUP BY nomor_ulok 
                        HAVING COUNT(*) > 1
                    )
            ),
            ulok_effective_dates AS (
                SELECT 
                    t.nomor_ulok,
                    ps.lingkup_pekerjaan,
                    ps.nomor_spk,
                    of.effective_end,
                    of.denda,
                    ps.waktu_selesai as original_end
                FROM opname_final of
                JOIN toko t ON t.id = of.id_toko
                JOIN pengajuan_spk ps ON ps.id_toko = t.id
                WHERE t.nomor_ulok IN (SELECT nomor_ulok FROM ulok_with_pertambahan)
                    AND ps.status = 'SPK_APPROVED'
            )
            SELECT 
                nomor_ulok,
                COUNT(DISTINCT effective_end) as unique_effective_dates,
                COUNT(*) as total_lingkup,
                jsonb_agg(
                    jsonb_build_object(
                        'lingkup', lingkup_pekerjaan,
                        'spk', nomor_spk,
                        'original_end', original_end,
                        'effective_end', effective_end,
                        'denda', denda
                    )
                ) as lingkup_details
            FROM ulok_effective_dates
            GROUP BY nomor_ulok
        `);

        const correctlyAligned = alignmentCheckQuery.rows.filter(
            (row: any) => parseInt(row.unique_effective_dates) === 1
        );
        const misaligned = alignmentCheckQuery.rows.filter(
            (row: any) => parseInt(row.unique_effective_dates) > 1
        );

        console.log('========================================');
        console.log('HASIL ALIGNMENT CHECK:');
        console.log('========================================\n');

        console.log(`✅ ULOKs ALIGNED CORRECTLY: ${correctlyAligned.length}`);
        console.log(`❌ ULOKs MISALIGNED: ${misaligned.length}\n`);

        // 4. Show sample correctly aligned ULOKs
        if (correctlyAligned.length > 0) {
            console.log('📊 SAMPLE CORRECTLY ALIGNED ULOKs (First 3):');
            console.log('========================================\n');
            
            correctlyAligned.slice(0, 3).forEach((ulok: any) => {
                console.log(`ULOK: ${ulok.nomor_ulok}`);
                console.log(`Total Lingkup: ${ulok.total_lingkup}`);
                console.log(`Lingkup Details:`);
                
                const details = JSON.parse(ulok.lingkup_details);
                details.forEach((detail: any) => {
                    console.log(`  - ${detail.lingkup}: ${detail.spk}`);
                    console.log(`    Original End: ${detail.original_end}`);
                    console.log(`    Effective End: ${detail.effective_end} ✅`);
                    console.log(`    Denda: Rp ${parseInt(detail.denda).toLocaleString('id-ID')}`);
                });
                console.log('');
            });
        }

        // 5. Show misaligned ULOKs (if any)
        if (misaligned.length > 0) {
            console.log('⚠️  MISALIGNED ULOKs DETECTED:');
            console.log('========================================\n');
            
            misaligned.forEach((ulok: any) => {
                console.log(`❌ ULOK: ${ulok.nomor_ulok}`);
                console.log(`   Total Lingkup: ${ulok.total_lingkup}`);
                console.log(`   Unique Effective Dates: ${ulok.unique_effective_dates} (SHOULD BE 1!)`);
                console.log(`   Lingkup Details:`);
                
                const details = JSON.parse(ulok.lingkup_details);
                details.forEach((detail: any) => {
                    console.log(`     - ${detail.lingkup}: ${detail.spk}`);
                    console.log(`       Effective End: ${detail.effective_end}`);
                    console.log(`       Denda: Rp ${parseInt(detail.denda).toLocaleString('id-ID')}`);
                });
                console.log('');
            });

            console.log('⚠️  ACTION REQUIRED: Run refresh denda untuk ULOKs di atas');
            console.log('   Jalankan: await opnameFinalService.refreshDendaByTokoId(toko_id)\n');
        }

        // 6. Overall Status
        console.log('========================================');
        console.log('OVERALL STATUS:');
        console.log('========================================\n');

        if (misaligned.length === 0) {
            console.log('✅ SEMUA DATA SUDAH ALIGNED!');
            console.log('✅ Data lama: Benar');
            console.log('✅ Data baru: Siap digunakan');
            console.log('✅ Logic cross-lingkup: Berfungsi dengan baik\n');
        } else {
            console.log('⚠️  ADA DATA YANG BELUM ALIGNED');
            console.log(`   ${misaligned.length} ULOKs perlu di-refresh`);
            console.log('   Jalankan script refresh-misaligned-denda.ts\n');
        }

        // 7. Specific check untuk ULOK 2VZ1-2604-0007 (test case)
        console.log('========================================');
        console.log('TEST CASE: ULOK 2VZ1-2604-0007');
        console.log('========================================\n');

        const testCaseQuery = await pool.query(`
            SELECT 
                t.nomor_ulok,
                t.id as toko_id,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                ps.waktu_selesai as original_end,
                of.effective_end,
                of.denda,
                CASE 
                    WHEN of.effective_end > ps.waktu_selesai 
                    THEN 'Extended ✅'
                    ELSE 'Not Extended ❌'
                END as extension_status
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
                AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `);

        if (testCaseQuery.rows.length > 0) {
            testCaseQuery.rows.forEach((row: any) => {
                console.log(`Lingkup: ${row.lingkup_pekerjaan}`);
                console.log(`  SPK: ${row.nomor_spk}`);
                console.log(`  Toko ID: ${row.toko_id}`);
                console.log(`  Original End: ${row.original_end}`);
                console.log(`  Effective End: ${row.effective_end}`);
                console.log(`  Denda: Rp ${parseInt(row.denda).toLocaleString('id-ID')}`);
                console.log(`  Status: ${row.extension_status}\n`);
            });

            const allExtended = testCaseQuery.rows.every(
                (row: any) => row.effective_end > row.original_end
            );
            const allZeroDenda = testCaseQuery.rows.every(
                (row: any) => parseInt(row.denda) === 0
            );

            if (allExtended && allZeroDenda) {
                console.log('✅ TEST CASE PASSED: Semua lingkup extended dan denda = 0');
            } else {
                console.log('❌ TEST CASE FAILED: Ada lingkup yang tidak extended atau masih ada denda');
            }
        } else {
            console.log('⚠️  ULOK 2VZ1-2604-0007 tidak ditemukan dalam database');
        }

        console.log('\n========================================');
        console.log('VERIFICATION COMPLETE');
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Error during verification:', error);
        throw error;
    }
}

// Run verification
verifyAllDataAlignment()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
