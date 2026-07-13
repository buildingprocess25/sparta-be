/**
 * Simple Node.js script to check why old_denda = 0 for LUWU records
 * Run: node analyze-why-denda-zero.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '../sparta-be.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const LUWU_ULOKS = [
    '2VZ1-2603-R353-R',
    '2VZ1-2603-R531-R',
    '2VZ1-2603-R702-R',
    '2VZ1-2603-R614-R',
    '2VZ1-2604-0001-R',
    '2VZ1-2603-0001'
];

async function analyze() {
    console.log('='.repeat(80));
    console.log('ANALYZING WHY OLD_DENDA = 0 for LUWU RECORDS');
    console.log('='.repeat(80));
    console.log('');

    for (const ulok of LUWU_ULOKS) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`ULOK: ${ulok}`);
        console.log('='.repeat(80));

        // 1. Check SPK
        const spkResult = await pool.query(`
            SELECT 
                id,
                id_toko,
                waktu_selesai,
                status,
                created_at
            FROM pengajuan_spk
            WHERE nomor_ulok = $1
        `, [ulok]);

        console.log('\n📋 PENGAJUAN_SPK:');
        if (spkResult.rows.length === 0) {
            console.log('   ❌ Tidak ada SPK!');
        } else {
            spkResult.rows.forEach(row => {
                console.log(`   ID SPK: ${row.id}`);
                console.log(`   ID Toko: ${row.id_toko}`);
                console.log(`   SPK End: ${row.waktu_selesai}`);
                console.log(`   Status: ${row.status}`);
                console.log(`   Created: ${row.created_at}`);
            });
        }

        if (spkResult.rows.length === 0) continue;
        const idToko = spkResult.rows[0].id_toko;

        // 2. Check Serah Terima
        const stResult = await pool.query(`
            SELECT 
                id,
                id_toko,
                created_at
            FROM berkas_serah_terima
            WHERE id_toko = $1
            ORDER BY created_at ASC
        `, [idToko]);

        console.log('\n📦 BERKAS_SERAH_TERIMA:');
        if (stResult.rows.length === 0) {
            console.log('   ❌ Tidak ada ST!');
        } else {
            stResult.rows.forEach((row, idx) => {
                console.log(`   ST #${idx + 1}:`);
                console.log(`     ID: ${row.id}`);
                console.log(`     Date: ${row.created_at}`);
            });
        }

        // 3. Check Opname Final
        const ofnResult = await pool.query(`
            SELECT 
                id,
                id_toko,
                hari_denda,
                nilai_denda,
                tanggal_akhir_spk_denda,
                tanggal_serah_terima_denda,
                status_opname_final,
                created_at
            FROM opname_final
            WHERE id_toko = $1
        `, [idToko]);

        console.log('\n💰 OPNAME_FINAL (DENDA):');
        if (ofnResult.rows.length === 0) {
            console.log('   ❌ Tidak ada Opname Final! (INI MASALAHNYA!)');
        } else {
            ofnResult.rows.forEach((row, idx) => {
                console.log(`   Opname Final #${idx + 1}:`);
                console.log(`     ID: ${row.id}`);
                console.log(`     Hari Denda: ${row.hari_denda ?? 'NULL'}`);
                console.log(`     Nilai Denda: Rp ${(row.nilai_denda ?? 0).toLocaleString('id-ID')}`);
                console.log(`     Tanggal SPK End (denda): ${row.tanggal_akhir_spk_denda ?? 'NULL'}`);
                console.log(`     Tanggal ST (denda): ${row.tanggal_serah_terima_denda ?? 'NULL'}`);
                console.log(`     Status: ${row.status_opname_final ?? 'NULL'}`);
                console.log(`     Created: ${row.created_at}`);
            });
        }

        // 4. Calculate what denda SHOULD be
        const spkEnd = new Date(spkResult.rows[0].waktu_selesai);
        const stDate = stResult.rows.length > 0 ? new Date(stResult.rows[0].created_at) : null;

        if (stDate) {
            const diffMs = stDate.getTime() - spkEnd.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            console.log('\n🧮 CALCULATED (WITHOUT grace period):');
            console.log(`   SPK End: ${spkEnd.toISOString().split('T')[0]}`);
            console.log(`   ST Date: ${stDate.toISOString().split('T')[0]}`);
            console.log(`   Raw Diff: ${diffDays} hari`);
            console.log(`   Grace: 1 hari kerja (seharusnya)`);
            console.log(`   Estimated Denda Days: ${Math.max(0, diffDays - 1)} hari (rough)`);

            if (diffDays > 10) {
                console.log(`   ⚠️  TERLAMBAT LEBIH DARI 10 HARI!`);
                console.log(`   Expected Denda: Rp 7.500.000 (max)`);
            }
        }

        // 5. Diagnosis
        console.log('\n🔍 DIAGNOSIS:');
        if (ofnResult.rows.length === 0) {
            console.log('   ❌ ROOT CAUSE: OPNAME_FINAL belum dibuat untuk toko ini!');
            console.log('   → Denda tidak bisa dicatat karena tabel opname_final kosong');
            console.log('   → Perlu create opname_final terlebih dahulu');
        } else if (ofnResult.rows[0].hari_denda === null || ofnResult.rows[0].hari_denda === 0) {
            console.log('   ⚠️  ROOT CAUSE: OPNAME_FINAL ada, tapi denda belum di-refresh!');
            console.log('   → Kemungkinan:');
            console.log('     1. refreshDenda() belum pernah dipanggil untuk toko ini');
            console.log('     2. ST dibuat SEBELUM opname_final (timing issue)');
            console.log('     3. Ada bug di logic refreshDenda()');
            console.log('   → Solution: Perlu refresh manual atau backfill');
        } else {
            console.log('   ✅ Denda sudah tercatat di opname_final');
        }
    }

    await pool.end();
}

analyze()
    .then(() => {
        console.log('\n✅ Analysis complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Error:', err);
        process.exit(1);
    });
