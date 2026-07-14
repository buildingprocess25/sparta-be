/**
 * Script untuk memperbaiki SPK yang created_at (timestamp) nya NULL
 * 
 * Strategi:
 * 1. Jika waktu_persetujuan ada, gunakan itu (karena SPK pasti dibuat sebelum diapprove)
 * 2. Jika tidak ada waktu_persetujuan, gunakan waktu_mulai (tanggal mulai pekerjaan)
 * 3. Jika tidak ada keduanya, gunakan NOW() sebagai fallback
 */

import { pool } from '../db/pool';

async function fixNullSpkTimestamp() {
  try {
    console.log('=== Memperbaiki SPK dengan Timestamp Kosong ===\n');

    // 1. Cek berapa banyak SPK yang timestamp-nya kosong
    const checkResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM pengajuan_spk
      WHERE created_at IS NULL
    `);

    const totalNull = parseInt(checkResult.rows[0]?.total || '0');
    console.log(`SPK dengan timestamp kosong: ${totalNull}`);

    if (totalNull === 0) {
      console.log('✓ Tidak ada SPK yang perlu diperbaiki');
      return;
    }

    console.log('\nDetail SPK yang akan diperbaiki:');

    // 2. Tampilkan detail SPK yang bermasalah
    const detailResult = await pool.query(`
      SELECT 
        ps.id,
        ps.nomor_spk,
        ps.nomor_ulok,
        ps.status,
        ps.waktu_mulai,
        ps.waktu_persetujuan,
        ps.nama_kontraktor,
        t.cabang
      FROM pengajuan_spk ps
      LEFT JOIN toko t ON t.id = ps.id_toko
      WHERE ps.created_at IS NULL
      ORDER BY ps.waktu_persetujuan DESC NULLS LAST, ps.waktu_mulai DESC NULLS LAST
    `);

    detailResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. SPK #${row.id} - ${row.nomor_spk || 'NO SPK BELUM ADA'}`);
      console.log(`   ULOK: ${row.nomor_ulok} | Cabang: ${row.cabang}`);
      console.log(`   Kontraktor: ${row.nama_kontraktor || '-'}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Waktu Mulai: ${row.waktu_mulai || 'NULL'}`);
      console.log(`   Waktu Persetujuan: ${row.waktu_persetujuan || 'NULL'}`);
      console.log('');
    });

    // 3. Konfirmasi sebelum fix
    console.log(`\nAkan memperbaiki ${totalNull} SPK dengan strategi:`);
    console.log('- Priority 1: Set created_at = waktu_persetujuan (jika ada)');
    console.log('- Priority 2: Set created_at = waktu_mulai (jika tidak ada waktu_persetujuan)');
    console.log('- Priority 3: Set created_at = NOW() (jika tidak ada keduanya)');
    console.log('');

    // 4. Execute fix dengan transaction
    await pool.query('BEGIN');

    try {
      // Strategy 1: Gunakan waktu_persetujuan
      const fix1Result = await pool.query(`
        UPDATE pengajuan_spk
        SET created_at = waktu_persetujuan
        WHERE created_at IS NULL
          AND waktu_persetujuan IS NOT NULL
      `);
      console.log(`✓ Fixed ${fix1Result.rowCount} SPK menggunakan waktu_persetujuan`);

      // Strategy 2: Gunakan waktu_mulai
      const fix2Result = await pool.query(`
        UPDATE pengajuan_spk
        SET created_at = waktu_mulai::timestamp
        WHERE created_at IS NULL
          AND waktu_mulai IS NOT NULL
      `);
      console.log(`✓ Fixed ${fix2Result.rowCount} SPK menggunakan waktu_mulai`);

      // Strategy 3: Gunakan NOW() sebagai fallback
      const fix3Result = await pool.query(`
        UPDATE pengajuan_spk
        SET created_at = timezone('Asia/Jakarta', now())
        WHERE created_at IS NULL
      `);
      console.log(`✓ Fixed ${fix3Result.rowCount} SPK menggunakan NOW()`);

      // Commit transaction
      await pool.query('COMMIT');
      console.log('\n✓ Transaction committed successfully');

    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('✗ Error during fix, transaction rolled back');
      throw error;
    }

    // 5. Verifikasi hasil
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM pengajuan_spk
      WHERE created_at IS NULL
    `);

    const remainingNull = parseInt(verifyResult.rows[0]?.total || '0');
    
    console.log('\n=== Verifikasi Hasil ===');
    console.log(`SPK dengan timestamp kosong sebelum fix: ${totalNull}`);
    console.log(`SPK dengan timestamp kosong setelah fix: ${remainingNull}`);
    
    if (remainingNull === 0) {
      console.log('\n✓ Semua SPK berhasil diperbaiki!');
    } else {
      console.log(`\n⚠️  Masih ada ${remainingNull} SPK yang timestamp-nya kosong`);
    }

    // 6. Tampilkan sample SPK yang sudah diperbaiki
    console.log('\n=== Sample SPK yang sudah diperbaiki ===');
    const sampleResult = await pool.query(`
      SELECT 
        ps.id,
        ps.nomor_spk,
        ps.nomor_ulok,
        ps.created_at AT TIME ZONE 'Asia/Jakarta' as created_at,
        ps.waktu_mulai,
        ps.waktu_persetujuan AT TIME ZONE 'Asia/Jakarta' as waktu_persetujuan,
        ps.status
      FROM pengajuan_spk ps
      WHERE ps.id IN (
        SELECT id FROM pengajuan_spk
        ORDER BY created_at DESC
        LIMIT 5
      )
      ORDER BY ps.created_at DESC
    `);

    sampleResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. SPK #${row.id} - ${row.nomor_spk || 'NO SPK BELUM ADA'}`);
      console.log(`   Created At: ${row.created_at}`);
      console.log(`   Waktu Mulai: ${row.waktu_mulai || 'NULL'}`);
      console.log(`   Waktu Persetujuan: ${row.waktu_persetujuan || 'NULL'}`);
      console.log(`   Status: ${row.status}`);
      console.log('');
    });

    console.log('\n✓ Script selesai!');

  } catch (error) {
    console.error('✗ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run script
fixNullSpkTimestamp()
  .then(() => {
    console.log('\n✓ Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Script execution failed:', error);
    process.exit(1);
  });
