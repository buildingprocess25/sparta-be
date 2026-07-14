/**
 * Refresh denda untuk ULOK 2VZ1-2604-0007 setelah fix cross-lingkup deployed
 */

import { pool } from "../db/pool";
import { opnameFinalService } from "../modules/opname-final/opname-final.service";

async function refreshUlokDenda() {
    const nomorUlok = "2VZ1-2604-0007";

    console.log('========================================');
    console.log(`REFRESH DENDA: ${nomorUlok}`);
    console.log('========================================\n');

    try {
        // 1. Get all toko in this ULOK
        const tokoQuery = await pool.query(`
            SELECT 
                t.id as toko_id,
                t.nomor_ulok,
                t.kode_toko,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                ps.nomor_spk
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = $1
                AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `, [nomorUlok]);

        if (tokoQuery.rows.length === 0) {
            console.log(`❌ No toko found for ULOK ${nomorUlok}`);
            return;
        }

        console.log(`Found ${tokoQuery.rows.length} toko(s) in ULOK ${nomorUlok}:\n`);
        tokoQuery.rows.forEach((row: any) => {
            console.log(`- ${row.lingkup_pekerjaan}: ${row.nama_toko} (ID: ${row.toko_id})`);
        });
        console.log('');

        // 2. Check denda BEFORE refresh
        console.log('📊 BEFORE REFRESH:');
        console.log('────────────────────────────────────────\n');

        const beforeQuery = await pool.query(`
            SELECT 
                t.nomor_ulok,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                of.hari_denda,
                of.nilai_denda,
                of.tanggal_akhir_spk_denda,
                of.tanggal_serah_terima_denda
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = $1
                AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `, [nomorUlok]);

        beforeQuery.rows.forEach((row: any) => {
            console.log(`${row.lingkup_pekerjaan}: ${row.nomor_spk}`);
            console.log(`  Hari Denda: ${row.hari_denda}`);
            console.log(`  Nilai Denda: Rp ${parseInt(row.nilai_denda || 0).toLocaleString('id-ID')}`);
            console.log(`  SPK End: ${row.tanggal_akhir_spk_denda}`);
            console.log(`  ST Date: ${row.tanggal_serah_terima_denda}\n`);
        });

        // 3. Refresh denda for each toko
        console.log('🔄 REFRESHING DENDA...\n');

        for (const row of tokoQuery.rows) {
            const tokoId = row.toko_id;
            console.log(`Refreshing Toko ID ${tokoId} (${row.lingkup_pekerjaan})...`);
            try {
                await opnameFinalService.refreshDendaByTokoId(tokoId);
                console.log(`✅ Success\n`);
            } catch (error) {
                console.error(`❌ Failed:`, error);
            }
        }

        // 4. Check denda AFTER refresh
        console.log('📊 AFTER REFRESH:');
        console.log('════════════════════════════════════════\n');

        const afterQuery = await pool.query(`
            SELECT 
                t.nomor_ulok,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                of.hari_denda,
                of.nilai_denda,
                of.tanggal_akhir_spk_denda,
                of.tanggal_serah_terima_denda
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = $1
                AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `, [nomorUlok]);

        let allFixed = true;
        afterQuery.rows.forEach((row: any) => {
            console.log(`${row.lingkup_pekerjaan}: ${row.nomor_spk}`);
            console.log(`  Hari Denda: ${row.hari_denda}`);
            console.log(`  Nilai Denda: Rp ${parseInt(row.nilai_denda || 0).toLocaleString('id-ID')}`);
            console.log(`  SPK End: ${row.tanggal_akhir_spk_denda}`);
            console.log(`  ST Date: ${row.tanggal_serah_terima_denda}`);
            
            const dendaValue = parseInt(row.nilai_denda || 0);
            if (dendaValue > 0) {
                console.log(`  ❌ STILL HAS PENALTY\n`);
                allFixed = false;
            } else {
                console.log(`  ✅ NO PENALTY\n`);
            }
        });

        // 5. Final summary
        console.log('════════════════════════════════════════');
        console.log('SUMMARY');
        console.log('════════════════════════════════════════\n');

        if (allFixed) {
            console.log('✅ SUCCESS! All denda cleared to Rp 0');
            console.log(`✅ ULOK ${nomorUlok} is now penalty-free\n`);
        } else {
            console.log('⚠️  Some lingkup still have denda');
            console.log('   This may be expected if:');
            console.log('   - SPK is overdue beyond pertambahan period');
            console.log('   - No pertambahan SPK approved yet');
            console.log('   - ST date is after extended deadline\n');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run
refreshUlokDenda()
    .then(() => {
        console.log('✅ Script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
