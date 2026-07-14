/**
 * Script untuk refresh denda pada ULOKs yang masih misaligned
 * setelah backend fix di-deploy
 */

import { db } from '../config/database';
import { opnameFinalService } from '../modules/opname-final/opname-final.service';

interface MisalignedUlok {
    nomor_ulok: string;
    toko_ids: number[];
    lingkup_details: any[];
}

async function refreshMisalignedDenda(): Promise<void> {
    console.log('========================================');
    console.log('REFRESH MISALIGNED DENDA');
    console.log('Pertambahan SPK Cross-Lingkup');
    console.log('========================================\n');

    try {
        // 1. Find misaligned ULOKs
        console.log('🔍 Mencari ULOKs yang misaligned...\n');

        const misalignedQuery = await db.query(`
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
                    t.id as toko_id,
                    ps.lingkup_pekerjaan,
                    ps.nomor_spk,
                    of.effective_end,
                    of.denda
                FROM opname_final of
                JOIN toko t ON t.id = of.id_toko
                JOIN pengajuan_spk ps ON ps.id_toko = t.id
                WHERE t.nomor_ulok IN (SELECT nomor_ulok FROM ulok_with_pertambahan)
                    AND ps.status = 'SPK_APPROVED'
            )
            SELECT 
                nomor_ulok,
                array_agg(DISTINCT toko_id) as toko_ids,
                COUNT(DISTINCT effective_end) as unique_effective_dates,
                jsonb_agg(
                    jsonb_build_object(
                        'toko_id', toko_id,
                        'lingkup', lingkup_pekerjaan,
                        'spk', nomor_spk,
                        'effective_end', effective_end,
                        'denda', denda
                    )
                ) as lingkup_details
            FROM ulok_effective_dates
            GROUP BY nomor_ulok
            HAVING COUNT(DISTINCT effective_end) > 1
        `);

        const misalignedUloks = misalignedQuery.rows;

        if (misalignedUloks.length === 0) {
            console.log('✅ TIDAK ADA ULOK YANG MISALIGNED!');
            console.log('✅ Semua data sudah benar\n');
            return;
        }

        console.log(`⚠️  Ditemukan ${misalignedUloks.length} ULOKs yang misaligned\n`);

        // 2. Show details
        console.log('📊 DETAIL ULOKs MISALIGNED:');
        console.log('========================================\n');

        misalignedUloks.forEach((ulok: any, index: number) => {
            console.log(`${index + 1}. ULOK: ${ulok.nomor_ulok}`);
            console.log(`   Toko IDs: ${ulok.toko_ids.join(', ')}`);
            console.log(`   Unique Effective Dates: ${ulok.unique_effective_dates}`);
            
            const details = JSON.parse(ulok.lingkup_details);
            details.forEach((detail: any) => {
                console.log(`   - ${detail.lingkup}: ${detail.spk}`);
                console.log(`     Toko ID: ${detail.toko_id}`);
                console.log(`     Effective End: ${detail.effective_end}`);
                console.log(`     Denda: Rp ${parseInt(detail.denda).toLocaleString('id-ID')}`);
            });
            console.log('');
        });

        // 3. Confirm refresh
        console.log('========================================');
        console.log('MULAI REFRESH DENDA');
        console.log('========================================\n');

        let successCount = 0;
        let errorCount = 0;

        for (const ulok of misalignedUloks) {
            console.log(`🔄 Refresh ULOK: ${ulok.nomor_ulok}...`);
            
            const tokoIds: number[] = ulok.toko_ids;
            
            for (const tokoId of tokoIds) {
                try {
                    await opnameFinalService.refreshDendaByTokoId(tokoId);
                    console.log(`   ✅ Toko ID ${tokoId} refreshed`);
                    successCount++;
                } catch (error) {
                    console.error(`   ❌ Toko ID ${tokoId} failed:`, error);
                    errorCount++;
                }
            }
            
            console.log('');
        }

        // 4. Verify after refresh
        console.log('========================================');
        console.log('VERIFIKASI SETELAH REFRESH');
        console.log('========================================\n');

        const verifyQuery = await db.query(`
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
                    of.effective_end,
                    of.denda
                FROM opname_final of
                JOIN toko t ON t.id = of.id_toko
                JOIN pengajuan_spk ps ON ps.id_toko = t.id
                WHERE t.nomor_ulok IN (SELECT nomor_ulok FROM ulok_with_pertambahan)
                    AND ps.status = 'SPK_APPROVED'
            )
            SELECT 
                nomor_ulok,
                COUNT(DISTINCT effective_end) as unique_effective_dates,
                jsonb_agg(
                    jsonb_build_object(
                        'lingkup', lingkup_pekerjaan,
                        'effective_end', effective_end,
                        'denda', denda
                    )
                ) as lingkup_details
            FROM ulok_effective_dates
            GROUP BY nomor_ulok
            HAVING COUNT(DISTINCT effective_end) > 1
        `);

        const stillMisaligned = verifyQuery.rows;

        console.log('📊 HASIL REFRESH:');
        console.log(`   ✅ Success: ${successCount} toko`);
        console.log(`   ❌ Error: ${errorCount} toko`);
        console.log(`   ⚠️  Still Misaligned: ${stillMisaligned.length} ULOKs\n`);

        if (stillMisaligned.length === 0) {
            console.log('✅ SEMUA ULOK SUDAH ALIGNED!');
            console.log('✅ Refresh berhasil\n');
        } else {
            console.log('⚠️  MASIH ADA ULOK YANG MISALIGNED:');
            stillMisaligned.forEach((ulok: any) => {
                console.log(`   - ${ulok.nomor_ulok}`);
                const details = JSON.parse(ulok.lingkup_details);
                details.forEach((detail: any) => {
                    console.log(`     ${detail.lingkup}: ${detail.effective_end}, Denda: Rp ${parseInt(detail.denda).toLocaleString('id-ID')}`);
                });
            });
            console.log('\n⚠️  Manual intervention mungkin diperlukan\n');
        }

        console.log('========================================');
        console.log('REFRESH COMPLETE');
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Error during refresh:', error);
        throw error;
    }
}

// Run refresh
refreshMisalignedDenda()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
