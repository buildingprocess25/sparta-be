const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- STARTING MIGRATION ---');

    // 1. Hapus RAB lama id=1163 (2605 SIPIL "Menunggu") + Gantt lama id=534
    console.log('Menghapus RAB lama (1163) dan Gantt lama (534) di toko 1867...');
    await client.query(`DELETE FROM rab_item WHERE id_rab = 1163`);
    await client.query(`DELETE FROM rab WHERE id = 1163`);

    // Gantt 534
    await client.query(`DELETE FROM pengawasan_gantt WHERE id_gantt = 534`);
    await client.query(`DELETE FROM day_gantt_chart WHERE id_gantt = 534`);
    await client.query(`DELETE FROM dependency_gantt WHERE id_gantt = 534`);
    await client.query(`DELETE FROM kategori_pekerjaan_gantt WHERE id_gantt = 534`);
    await client.query(`DELETE FROM gantt_chart_note WHERE id_gantt = 534`);
    await client.query(`DELETE FROM gantt_chart WHERE id = 534`);

    // 2. Pindahkan semua relasi dari toko id=1916 -> id=1867
    console.log('Memindahkan data dari toko 1916 ke toko 1867...');
    await client.query(`UPDATE rab SET id_toko = 1867 WHERE id_toko = 1916`);
    await client.query(`UPDATE pengajuan_spk SET id_toko = 1867 WHERE id_toko = 1916`);
    await client.query(`UPDATE pic_pengawasan SET id_toko = 1867 WHERE id_toko = 1916`);
    await client.query(`UPDATE gantt_chart SET id_toko = 1867 WHERE id_toko = 1916`);
    await client.query(`UPDATE berkas_serah_terima SET id_toko = 1867 WHERE id_toko = 1916`);
    await client.query(`UPDATE opname_final SET id_toko = 1867 WHERE id_toko = 1916`);
    await client.query(`UPDATE instruksi_lapangan SET id_toko = 1867 WHERE id_toko = 1916`);
    await client.query(`UPDATE opname_item SET id_toko = 1867 WHERE id_toko = 1916`);
    // update pengawasan table (if has id_toko)
    // wait, pengawasan doesn't have id_toko, it links via id_pengawasan_gantt -> gantt_chart -> id_toko

    // 3. Update toko id=1867 dengan kode_toko='H579' dan nama_toko dari 1916
    console.log('Update toko 1867...');
    await client.query(`UPDATE toko SET kode_toko = 'H579', nama_toko = 'LAMPER TENGAH RAYA SMG' WHERE id = 1867`);

    // 4. Hapus toko id=1916
    console.log('Menghapus toko 1916...');
    await client.query(`DELETE FROM toko WHERE id = 1916`);

    await client.query('COMMIT');
    console.log('--- MIGRATION SUCCESSFUL ---');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('--- MIGRATION FAILED, ROLLED BACK ---', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
