import { pool } from '../db/pool';

/**
 * Execute SQL fix script for ULOK 2VZ1-2604-0007 denda issue
 */
async function executeFixScript() {
    console.log('🔧 Executing SQL Fix Script: ULOK 2VZ1-2604-0007 Denda Fix');
    console.log('=' .repeat(70));

    try {

        // Execute BEFORE check
        console.log('\n📊 STEP 1: Checking current state (BEFORE FIX)...\n');
        const beforeResult = await pool.query(`
            SELECT 
                '=== BEFORE FIX ===' as status,
                t.nomor_ulok,
                t.id as toko_id,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                of.nilai_denda,
                of.hari_denda,
                of.tanggal_akhir_spk_denda
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
              AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `);
        console.table(beforeResult.rows);

        // Execute UPDATE
        console.log('\n🔧 STEP 2: Applying fix (UPDATE denda to 0)...\n');
        const updateResult = await pool.query(`
            UPDATE opname_final
            SET nilai_denda = 0,
                hari_denda = 0,
                tanggal_akhir_spk_denda = '2026-07-15'
            WHERE id_toko IN (
                SELECT t.id
                FROM toko t
                WHERE t.nomor_ulok = '2VZ1-2604-0007'
            )
        `);
        console.log(`✅ ${updateResult.rowCount} row(s) updated`);

        // Execute AFTER check
        console.log('\n📊 STEP 3: Verifying fix (AFTER FIX)...\n');
        const afterResult = await pool.query(`
            SELECT 
                '=== AFTER FIX ===' as status,
                t.nomor_ulok,
                t.id as toko_id,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                of.nilai_denda,
                of.hari_denda,
                of.tanggal_akhir_spk_denda,
                CASE 
                    WHEN of.nilai_denda = 0 THEN '✅ FIXED'
                    ELSE '❌ STILL HAS DENDA'
                END as fix_status
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
              AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `);
        console.table(afterResult.rows);

        console.log('\n' + '='.repeat(70));
        console.log('✅ SQL Fix Script Executed Successfully!');
        console.log('✅ ULOK 2VZ1-2604-0007 denda should now be Rp 0');
        console.log('=' .repeat(70));

    } catch (error: any) {
        console.error('\n❌ Error executing fix script:');
        console.error(error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Execute
executeFixScript()
    .then(() => {
        console.log('\n🎉 Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
