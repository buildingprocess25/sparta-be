/**
 * URGENT FIX: Refresh denda untuk ULOK 2VZ1-2604-0007
 * yang masih menunjukkan Rp 1.000.000 di production
 */

import { pool } from "../db/pool";
import { opnameFinalService } from "../modules/opname-final/opname-final.service";

async function fixDendaNow() {
    const nomorUlok = "2VZ1-2604-0007";

    console.log('========================================');
    console.log('URGENT FIX: ULOK 2VZ1-2604-0007 DENDA');
    console.log('========================================\n');

    try {
        // 1. Check current status
        console.log('🔍 Step 1: Checking current denda status...\n');

        const currentStatus = await pool.query(`
            SELECT 
                t.id as toko_id,
                t.nomor_ulok,
                t.kode_toko,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                ps.waktu_selesai as original_end,
                of.effective_end,
                of.denda,
                CURRENT_DATE as today
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = $1
                AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `, [nomorUlok]);

        console.log('Current Status:');
        console.log('────────────────────────────────────────\n');

        currentStatus.rows.forEach((row: any) => {
            console.log(`Toko: ${row.nama_toko} (${row.kode_toko})`);
            console.log(`Toko ID: ${row.toko_id}`);
            console.log(`Lingkup: ${row.lingkup_pekerjaan}`);
            console.log(`SPK: ${row.nomor_spk}`);
            console.log(`Original End: ${row.original_end}`);
            console.log(`Effective End: ${row.effective_end}`);
            console.log(`Denda: Rp ${parseInt(row.denda).toLocaleString('id-ID')}`);
            console.log(`Today: ${row.today}`);
            
            if (parseInt(row.denda) > 0) {
                console.log(`❌ STATUS: STILL HAS PENALTY\n`);
            } else {
                console.log(`✅ STATUS: NO PENALTY\n`);
            }
        });

        // 2. Check pertambahan SPK
        console.log('🔍 Step 2: Checking pertambahan SPK...\n');

        const pertambahanCheck = await pool.query(`
            SELECT 
                pt.id,
                pt.id_spk,
                ps.nomor_spk,
                ps.lingkup_pekerjaan,
                t.nomor_ulok,
                pt.pertambahan_hari,
                pt.tanggal_spk_akhir,
                pt.tanggal_spk_akhir_setelah_perpanjangan,
                pt.status_persetujuan,
                pt.created_at,
                pt.waktu_persetujuan
            FROM pertambahan_spk pt
            JOIN pengajuan_spk ps ON ps.id = pt.id_spk
            JOIN toko t ON t.id = ps.id_toko
            WHERE t.nomor_ulok = $1
            ORDER BY pt.created_at DESC
        `, [nomorUlok]);

        if (pertambahanCheck.rows.length === 0) {
            console.log('❌ NO PERTAMBAHAN SPK FOUND!');
            console.log('   This ULOK has no approved pertambahan SPK.\n');
        } else {
            console.log('Pertambahan SPK Found:');
            console.log('────────────────────────────────────────\n');

            pertambahanCheck.rows.forEach((row: any) => {
                console.log(`ID: ${row.id}`);
                console.log(`SPK: ${row.nomor_spk} (${row.lingkup_pekerjaan})`);
                console.log(`Pertambahan: +${row.pertambahan_hari} hari`);
                console.log(`Status: ${row.status_persetujuan}`);
                console.log(`Original End: ${row.tanggal_spk_akhir}`);
                console.log(`New End: ${row.tanggal_spk_akhir_setelah_perpanjangan}`);
                console.log(`Created: ${row.created_at}`);
                console.log(`Approved: ${row.waktu_persetujuan || 'Not yet'}\n`);
            });
        }

        // 3. Check if backend fix is deployed (test query)
        console.log('🔍 Step 3: Testing if backend fix is deployed...\n');

        const backendFixTest = await pool.query(`
            SELECT 
                t.nomor_ulok,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                pt.pertambahan_hari,
                pt.tanggal_spk_akhir_setelah_perpanjangan
            FROM pengajuan_spk ps
            JOIN toko t ON t.id = ps.id_toko
            LEFT JOIN LATERAL (
                SELECT 
                    pt.pertambahan_hari,
                    pt.tanggal_spk_akhir_setelah_perpanjangan
                FROM pertambahan_spk pt
                JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
                JOIN toko t_source ON t_source.id = ps_source.id_toko
                WHERE t_source.nomor_ulok = t.nomor_ulok
                    AND pt.status_persetujuan = 'Disetujui BM'
                ORDER BY pt.created_at DESC
                LIMIT 1
            ) pt ON true
            WHERE t.nomor_ulok = $1
                AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `, [nomorUlok]);

        console.log('Backend Fix Test (Cross-Lingkup Query):');
        console.log('────────────────────────────────────────\n');

        let backendFixWorking = true;
        const firstPertambahan = backendFixTest.rows[0]?.pertambahan_hari;

        backendFixTest.rows.forEach((row: any) => {
            console.log(`${row.lingkup_pekerjaan}: ${row.nomor_spk}`);
            console.log(`  Pertambahan: ${row.pertambahan_hari || 'NULL'} hari`);
            console.log(`  New End: ${row.tanggal_spk_akhir_setelah_perpanjangan || 'NULL'}`);
            
            if (row.pertambahan_hari !== firstPertambahan) {
                backendFixWorking = false;
            }
        });

        if (backendFixWorking && firstPertambahan) {
            console.log('\n✅ BACKEND FIX IS DEPLOYED! (Cross-lingkup query working)\n');
        } else {
            console.log('\n❌ BACKEND FIX NOT DEPLOYED YET! (Query still per-SPK)\n');
            console.log('⚠️  ACTION: Deploy backend fix from sp.repository.ts\n');
        }

        // 4. Refresh denda for all toko in this ULOK
        console.log('🔄 Step 4: Refreshing denda calculation...\n');

        const tokoIds = currentStatus.rows.map((row: any) => row.toko_id);
        console.log(`Found ${tokoIds.length} toko(s) in ULOK ${nomorUlok}`);
        console.log(`Toko IDs: ${tokoIds.join(', ')}\n`);

        for (const tokoId of tokoIds) {
            console.log(`Refreshing denda for Toko ID ${tokoId}...`);
            try {
                await opnameFinalService.refreshDendaByTokoId(tokoId);
                console.log(`✅ Toko ID ${tokoId} refreshed successfully\n`);
            } catch (error) {
                console.error(`❌ Toko ID ${tokoId} refresh failed:`, error);
            }
        }

        // 5. Check new status after refresh
        console.log('🔍 Step 5: Checking status after refresh...\n');

        const afterRefresh = await pool.query(`
            SELECT 
                t.id as toko_id,
                t.nomor_ulok,
                t.kode_toko,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                ps.waktu_selesai as original_end,
                of.effective_end,
                of.denda,
                CURRENT_DATE as today
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = $1
                AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `, [nomorUlok]);

        console.log('Status After Refresh:');
        console.log('════════════════════════════════════════\n');

        let allFixed = true;
        afterRefresh.rows.forEach((row: any) => {
            console.log(`Toko: ${row.nama_toko} (${row.kode_toko})`);
            console.log(`Lingkup: ${row.lingkup_pekerjaan}`);
            console.log(`SPK: ${row.nomor_spk}`);
            console.log(`Original End: ${row.original_end}`);
            console.log(`Effective End: ${row.effective_end}`);
            console.log(`Denda: Rp ${parseInt(row.denda).toLocaleString('id-ID')}`);
            
            if (parseInt(row.denda) > 0) {
                console.log(`❌ STATUS: STILL HAS PENALTY\n`);
                allFixed = false;
            } else {
                console.log(`✅ STATUS: NO PENALTY\n`);
            }
        });

        // 6. Final summary
        console.log('════════════════════════════════════════');
        console.log('FINAL SUMMARY');
        console.log('════════════════════════════════════════\n');

        if (allFixed) {
            console.log('✅ SUCCESS! All denda fixed to Rp 0');
            console.log('✅ ULOK 2VZ1-2604-0007 is now penalty-free\n');
        } else {
            console.log('❌ ISSUE: Denda still exists after refresh');
            console.log('\n⚠️  POSSIBLE CAUSES:');
            console.log('   1. Backend fix not deployed yet (check step 3)');
            console.log('   2. Pertambahan SPK not approved');
            console.log('   3. SPK already overdue beyond pertambahan\n');
            
            console.log('📋 NEXT ACTIONS:');
            if (!backendFixWorking) {
                console.log('   1. Deploy backend fix: sp.repository.ts');
                console.log('   2. Re-run this script after deployment');
            } else {
                console.log('   1. Check pertambahan SPK status (should be "Disetujui BM")');
                console.log('   2. Verify pertambahan_hari is sufficient');
                console.log('   3. Check if today is still within extended period');
            }
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run fix
fixDendaNow()
    .then(() => {
        console.log('✅ Script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
