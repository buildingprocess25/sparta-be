/**
 * Script untuk menghapus ULOK 1GZ1-2606-0016 (BANGUN JAYA)
 * dan semua data terkait dari database
 * 
 * Toko: BANGUN JAYA
 * Lokasi: JL. BANGUN JAYA, KAB. SUKAMARA, KALIMANTAN TENGAH
 * Cabang: BANJARMASIN
 * 
 * Data yang akan dihapus:
 * - 2 entries toko (SIPIL id=2548, ME id=2553)
 * - 2 RAB dengan semua items (CASCADE)
 * - 2 Gantt chart dengan dependencies (CASCADE)
 * - SPK dan Opname jika ada (CASCADE)
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL tidak ditemukan di environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  connectionTimeoutMillis: 10000,
});

interface DeletionSummary {
  tabel: string;
  jumlah: number;
}

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Terhubung ke database...');
    console.log('📋 Memulai proses penghapusan ULOK 1GZ1-2606-0016\n');
    
    // Begin Transaction
    await client.query('BEGIN');
    console.log('✅ Transaction dimulai\n');
    
    // ============================================================
    // STEP 1: Preview Data yang Akan Dihapus
    // ============================================================
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 1: PREVIEW DATA YANG AKAN DIHAPUS');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Preview Toko
    console.log('📍 TOKO yang akan dihapus:');
    const tokoResult = await client.query(`
      SELECT 
        id AS id_toko,
        nomor_ulok,
        lingkup_pekerjaan,
        nama_toko,
        kode_toko,
        cabang,
        alamat,
        nama_kontraktor,
        proyek
      FROM toko
      WHERE nomor_ulok = '1GZ1-2606-0016'
      ORDER BY id
    `);
    console.table(tokoResult.rows);
    
    // Preview RAB
    console.log('💰 RAB yang akan dihapus (CASCADE):');
    const rabResult = await client.query(`
      SELECT 
        r.id AS id_rab,
        r.id_toko,
        r.no_sph,
        r.status,
        r.nama_pt,
        r.grand_total,
        r.grand_total_final,
        r.email_pembuat,
        r.created_at
      FROM rab r
      JOIN toko t ON t.id = r.id_toko
      WHERE t.nomor_ulok = '1GZ1-2606-0016'
      ORDER BY r.id
    `);
    console.table(rabResult.rows);
    
    // Preview Gantt
    console.log('📅 GANTT CHART yang akan dihapus (CASCADE):');
    const ganttResult = await client.query(`
      SELECT 
        g.id AS id_gantt,
        g.id_toko,
        g.status,
        g.email_pembuat,
        g.timestamp,
        t.nomor_ulok
      FROM gantt_chart g
      JOIN toko t ON t.id = g.id_toko
      WHERE t.nomor_ulok = '1GZ1-2606-0016'
      ORDER BY g.id
    `);
    console.table(ganttResult.rows);
    
    // ============================================================
    // STEP 2: Count Summary
    // ============================================================
    console.log('\n═══════════════════════════════════════════════════');
    console.log('STEP 2: RINGKASAN JUMLAH DATA');
    console.log('═══════════════════════════════════════════════════\n');
    
    const summaryResult = await client.query<DeletionSummary>(`
      WITH deletion_summary AS (
        SELECT 'Toko' AS tabel, COUNT(*)::int AS jumlah
        FROM toko WHERE nomor_ulok = '1GZ1-2606-0016'
        
        UNION ALL
        
        SELECT 'RAB' AS tabel, COUNT(*)::int AS jumlah
        FROM rab r
        JOIN toko t ON t.id = r.id_toko
        WHERE t.nomor_ulok = '1GZ1-2606-0016'
        
        UNION ALL
        
        SELECT 'RAB Items' AS tabel, COUNT(*)::int AS jumlah
        FROM rab_item ri
        JOIN rab r ON r.id = ri.id_rab
        JOIN toko t ON t.id = r.id_toko
        WHERE t.nomor_ulok = '1GZ1-2606-0016'
        
        UNION ALL
        
        SELECT 'Gantt Chart' AS tabel, COUNT(*)::int AS jumlah
        FROM gantt_chart g
        JOIN toko t ON t.id = g.id_toko
        WHERE t.nomor_ulok = '1GZ1-2606-0016'
        
        UNION ALL
        
        SELECT 'Pengajuan SPK' AS tabel, COUNT(*)::int AS jumlah
        FROM pengajuan_spk ps
        WHERE ps.nomor_ulok = '1GZ1-2606-0016'
      )
      SELECT * FROM deletion_summary ORDER BY tabel
    `);
    
    console.table(summaryResult.rows);
    
    const totalRecords = summaryResult.rows.reduce((sum, row) => sum + row.jumlah, 0);
    console.log(`\n📊 Total records yang akan dihapus: ${totalRecords}\n`);
    
    // ============================================================
    // STEP 3: Backup Data ke Temporary Tables
    // ============================================================
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 3: BACKUP DATA KE TEMPORARY TABLES');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Backup toko
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS _backup_toko_deleted AS
      SELECT *, now() AS deleted_at
      FROM toko
      WHERE nomor_ulok = '1GZ1-2606-0016'
    `);
    console.log('✅ Backup toko selesai');
    
    // Backup rab
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS _backup_rab_deleted AS
      SELECT r.*, now() AS deleted_at
      FROM rab r
      JOIN toko t ON t.id = r.id_toko
      WHERE t.nomor_ulok = '1GZ1-2606-0016'
    `);
    console.log('✅ Backup rab selesai');
    
    // Backup rab_item
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS _backup_rab_item_deleted AS
      SELECT ri.*, now() AS deleted_at
      FROM rab_item ri
      JOIN rab r ON r.id = ri.id_rab
      JOIN toko t ON t.id = r.id_toko
      WHERE t.nomor_ulok = '1GZ1-2606-0016'
    `);
    console.log('✅ Backup rab_item selesai');
    
    // Backup gantt
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS _backup_gantt_deleted AS
      SELECT g.*, now() AS deleted_at
      FROM gantt_chart g
      JOIN toko t ON t.id = g.id_toko
      WHERE t.nomor_ulok = '1GZ1-2606-0016'
    `);
    console.log('✅ Backup gantt_chart selesai\n');
    
    // ============================================================
    // STEP 4: DELETE DATA
    // ============================================================
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 4: MENGHAPUS DATA (CASCADE DELETE)');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('⚠️  PERHATIAN: Proses penghapusan dimulai...');
    console.log('    Data akan dihapus dari tabel toko dan cascade ke semua tabel terkait\n');
    
    const deleteResult = await client.query(`
      DELETE FROM toko
      WHERE nomor_ulok = '1GZ1-2606-0016'
    `);
    
    console.log(`✅ Berhasil menghapus ${deleteResult.rowCount} records dari tabel toko`);
    console.log('✅ CASCADE DELETE otomatis menghapus semua data terkait\n');
    
    // ============================================================
    // STEP 5: Verifikasi Hasil
    // ============================================================
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 5: VERIFIKASI HASIL PENGHAPUSAN');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Cek hasil dari backup
    const backupCountResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM _backup_toko_deleted) AS toko_dihapus,
        (SELECT COUNT(*) FROM _backup_rab_deleted) AS rab_dihapus,
        (SELECT COUNT(*) FROM _backup_rab_item_deleted) AS rab_items_dihapus,
        (SELECT COUNT(*) FROM _backup_gantt_deleted) AS gantt_dihapus
    `);
    
    console.log('📊 Jumlah data yang berhasil di-backup:');
    console.table(backupCountResult.rows[0]);
    
    // Verifikasi data sudah tidak ada
    const verifyResult = await client.query(`
      SELECT 
        CASE 
          WHEN EXISTS (SELECT 1 FROM toko WHERE nomor_ulok = '1GZ1-2606-0016')
          THEN 'GAGAL - Data masih ada!'
          ELSE 'SUKSES - Data sudah terhapus'
        END AS status_penghapusan
    `);
    
    const status = verifyResult.rows[0].status_penghapusan;
    console.log(`\n${status.startsWith('SUKSES') ? '✅' : '❌'} ${status}\n`);
    
    if (status.startsWith('GAGAL')) {
      throw new Error('Verifikasi gagal - data masih ada di database');
    }
    
    // ============================================================
    // STEP 6: COMMIT Transaction
    // ============================================================
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 6: COMMIT TRANSACTION');
    console.log('═══════════════════════════════════════════════════\n');
    
    await client.query('COMMIT');
    console.log('✅ Transaction berhasil di-COMMIT');
    console.log('✅ Penghapusan ULOK 1GZ1-2606-0016 SELESAI\n');
    
    console.log('═══════════════════════════════════════════════════');
    console.log('RINGKASAN AKHIR');
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ ULOK 1GZ1-2606-0016 (BANGUN JAYA) berhasil dihapus');
    console.log('✅ Semua data terkait berhasil dihapus (CASCADE)');
    console.log('✅ Database dalam kondisi konsisten');
    console.log('═══════════════════════════════════════════════════\n');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR: Terjadi kesalahan saat menghapus data');
    console.error('❌ Transaction telah di-ROLLBACK');
    console.error('❌ Tidak ada perubahan yang tersimpan ke database\n');
    console.error('Detail error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
