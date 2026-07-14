import { pool } from '../db/pool';

/**
 * Check if ULOK 2VZ1-2604-0007 exists in production database
 */
async function checkUlokExistence() {
    console.log('🔍 Checking ULOK 2VZ1-2604-0007 in Production Database');
    console.log('=' .repeat(70));

    try {
        // Check toko
        console.log('\n📦 STEP 1: Checking toko table...\n');
        const tokoResult = await pool.query(`
            SELECT 
                id,
                nomor_ulok,
                kode_toko,
                nama_toko
            FROM toko
            WHERE nomor_ulok = '2VZ1-2604-0007'
            ORDER BY id
        `);
        
        if (tokoResult.rows.length === 0) {
            console.log('❌ ULOK 2VZ1-2604-0007 NOT FOUND in toko table');
            console.log('ℹ️  This ULOK might not exist in production yet');
        } else {
            console.log(`✅ Found ${tokoResult.rows.length} toko record(s):`);
            console.table(tokoResult.rows);
        }

        // Check pengajuan_spk
        console.log('\n📋 STEP 2: Checking pengajuan_spk table...\n');
        const spkResult = await pool.query(`
            SELECT 
                ps.id,
                ps.nomor_spk,
                ps.lingkup_pekerjaan,
                ps.status,
                ps.waktu_selesai,
                t.nomor_ulok,
                t.kode_toko
            FROM pengajuan_spk ps
            JOIN toko t ON t.id = ps.id_toko
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
            ORDER BY ps.lingkup_pekerjaan
        `);
        
        if (spkResult.rows.length === 0) {
            console.log('❌ No SPK found for ULOK 2VZ1-2604-0007');
        } else {
            console.log(`✅ Found ${spkResult.rows.length} SPK record(s):`);
            console.table(spkResult.rows);
        }

        // Check pertambahan_spk
        console.log('\n📝 STEP 3: Checking pertambahan_spk table...\n');
        const pertambahanResult = await pool.query(`
            SELECT 
                pt.id,
                pt.id_spk,
                pt.status_persetujuan,
                pt.tanggal_spk_akhir_setelah_perpanjangan,
                ps.nomor_spk,
                ps.lingkup_pekerjaan,
                t.nomor_ulok
            FROM pertambahan_spk pt
            JOIN pengajuan_spk ps ON ps.id = pt.id_spk
            JOIN toko t ON t.id = ps.id_toko
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
            ORDER BY pt.id
        `);
        
        if (pertambahanResult.rows.length === 0) {
            console.log('❌ No pertambahan SPK found for ULOK 2VZ1-2604-0007');
        } else {
            console.log(`✅ Found ${pertambahanResult.rows.length} pertambahan record(s):`);
            console.table(pertambahanResult.rows);
        }

        // Check opname_final
        console.log('\n🎯 STEP 4: Checking opname_final table...\n');
        const opnameResult = await pool.query(`
            SELECT 
                of.id,
                of.id_toko,
                of.nilai_denda,
                of.hari_denda,
                of.tanggal_akhir_spk_denda,
                t.nomor_ulok,
                t.kode_toko
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
            ORDER BY of.id
        `);
        
        if (opnameResult.rows.length === 0) {
            console.log('❌ No opname_final found for ULOK 2VZ1-2604-0007');
        } else {
            console.log(`✅ Found ${opnameResult.rows.length} opname_final record(s):`);
            console.table(opnameResult.rows);
        }

        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 SUMMARY:');
        console.log('=' .repeat(70));
        console.log(`Toko records:           ${tokoResult.rows.length}`);
        console.log(`SPK records:            ${spkResult.rows.length}`);
        console.log(`Pertambahan SPK:        ${pertambahanResult.rows.length}`);
        console.log(`Opname Final records:   ${opnameResult.rows.length}`);
        console.log('=' .repeat(70));

        if (tokoResult.rows.length === 0) {
            console.log('\n⚠️  CONCLUSION: ULOK 2VZ1-2604-0007 does not exist in production database');
            console.log('ℹ️  This might be a test/staging-only ULOK');
        } else if (opnameResult.rows.length === 0) {
            console.log('\n⚠️  CONCLUSION: ULOK exists but no opname_final yet');
            console.log('ℹ️  No denda fix needed at this stage');
        } else {
            console.log('\n✅ CONCLUSION: ULOK exists and has opname_final data');
            
            const hasDenda = opnameResult.rows.some((row: any) => row.nilai_denda > 0);
            if (hasDenda) {
                console.log('⚠️  DENDA DETECTED! Fix needed.');
            } else {
                console.log('✅ No denda detected. Already fixed or no penalty applied.');
            }
        }

    } catch (error: any) {
        console.error('\n❌ Error checking ULOK:');
        console.error(error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Execute
checkUlokExistence()
    .then(() => {
        console.log('\n🎉 Check completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Check failed:', error);
        process.exit(1);
    });
