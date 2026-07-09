const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    // Toko IDs based on previous query:
    // HZ01-2605-H579-R: id=1873 (ME), id=1867 (SIPIL)
    // HZ01-2606-H579-R: id=1916 (SIPIL)
    const tokoIds = [1867, 1873, 1916];

    // Check RAB data
    const rabRes = await pool.query(`
      SELECT r.id, r.id_toko, t.nomor_ulok, t.lingkup_pekerjaan, r.status, r.email_pembuat, r.grand_total_final, r.created_at
      FROM rab r
      JOIN toko t ON t.id = r.id_toko
      WHERE t.id = ANY($1)
      ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, r.id
    `, [tokoIds]);
    console.log('=== RAB DATA ===');
    console.log(JSON.stringify(rabRes.rows, null, 2));

    // Check SPK columns
    const spkColRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pengajuan_spk' 
      ORDER BY ordinal_position
    `);
    const spkCols = spkColRes.rows.map(r => r.column_name);
    console.log('\n=== SPK COLUMNS ===');
    console.log(spkCols.join(', '));

    // Check SPK data
    const spkRes = await pool.query(`
      SELECT p.id, p.id_toko, t.nomor_ulok, t.lingkup_pekerjaan, p.status, p.nomor_spk, p.waktu_mulai, p.durasi
      FROM pengajuan_spk p
      JOIN toko t ON t.id = p.id_toko
      WHERE p.id_toko = ANY($1)
      ORDER BY t.nomor_ulok, t.lingkup_pekerjaan, p.id
    `, [tokoIds]);
    console.log('\n=== SPK DATA ===');
    console.log(JSON.stringify(spkRes.rows, null, 2));

    // Check pic_pengawasan
    const picRes = await pool.query(`
      SELECT pic.id, pic.id_toko, t.nomor_ulok, t.lingkup_pekerjaan, pic.plc_building_support
      FROM pic_pengawasan pic
      JOIN toko t ON t.id = pic.id_toko
      WHERE pic.id_toko = ANY($1)
      ORDER BY t.nomor_ulok, t.lingkup_pekerjaan
    `, [tokoIds]);
    console.log('\n=== PIC PENGAWASAN ===');
    console.log(JSON.stringify(picRes.rows, null, 2));

    // Check gantt_chart
    const ganttRes = await pool.query(`
      SELECT g.id, g.id_toko, t.nomor_ulok, t.lingkup_pekerjaan, g.status, g.email_pembuat, g.timestamp
      FROM gantt_chart g
      JOIN toko t ON t.id = g.id_toko
      WHERE g.id_toko = ANY($1)
      ORDER BY t.nomor_ulok, t.lingkup_pekerjaan
    `, [tokoIds]);
    console.log('\n=== GANTT CHART ===');
    console.log(JSON.stringify(ganttRes.rows, null, 2));

    // Check pengawasan table
    const pengawasanColRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pengawasan' 
      ORDER BY ordinal_position
    `);
    console.log('\n=== PENGAWASAN TABLE COLUMNS ===');
    console.log(pengawasanColRes.rows.map(r => r.column_name).join(', '));

    // Check pengawasan gantt
    const pengawasanGanttRes = await pool.query(`
      SELECT pg.id, pg.id_gantt, pg.tanggal_pengawasan, g.id_toko, t.nomor_ulok, t.lingkup_pekerjaan
      FROM pengawasan_gantt pg
      JOIN gantt_chart g ON g.id = pg.id_gantt
      JOIN toko t ON t.id = g.id_toko
      WHERE g.id_toko = ANY($1)
      ORDER BY t.nomor_ulok, pg.id
    `, [tokoIds]);
    console.log('\n=== PENGAWASAN GANTT ===');
    console.log(JSON.stringify(pengawasanGanttRes.rows, null, 2));

    // Check instuksil lapangan
    const ilRes = await pool.query(`
      SELECT il.id, il.id_toko, t.nomor_ulok, t.lingkup_pekerjaan, il.status
      FROM instruksi_lapangan il
      JOIN toko t ON t.id = il.id_toko
      WHERE il.id_toko = ANY($1)
      ORDER BY t.nomor_ulok, il.id
    `, [tokoIds]);
    console.log('\n=== INSTRUKSI LAPANGAN ===');
    console.log(JSON.stringify(ilRes.rows, null, 2));

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
