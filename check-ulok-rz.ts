import { pool } from './src/db/pool';

async function main() {
  try {
    const tokoRows = await pool.query(`
      SELECT id, nomor_ulok, lingkup_pekerjaan
      FROM toko 
      WHERE nomor_ulok = 'RZ01-2604-0012'
    `);
    console.log("Toko:");
    console.table(tokoRows.rows);

    const ids = tokoRows.rows.map(row => row.id);
    
    if (ids.length > 0) {
      const rabRows = await pool.query(`
        SELECT id, id_toko, status, durasi_pekerjaan
        FROM rab
        WHERE id_toko = ANY($1)
      `, [ids]);
      console.log("RAB:");
      console.table(rabRows.rows);

      const spkRows = await pool.query(`
        SELECT id, id_toko, lingkup_pekerjaan, waktu_mulai, waktu_selesai, durasi
        FROM pengajuan_spk
        WHERE id_toko = ANY($1) OR nomor_ulok = 'RZ01-2604-0012'
      `, [ids]);
      console.log("Pengajuan SPK:");
      console.table(spkRows.rows);

      const ganttRows = await pool.query(`
        SELECT id, id_toko, status, lingkup_pekerjaan
        FROM gantt_chart
        WHERE id_toko = ANY($1)
      `, [ids]);
      console.log("Gantt Chart:");
      console.table(ganttRows.rows);

      const ganttIds = ganttRows.rows.map(g => g.id);

      if (ganttIds.length > 0) {
        const pengawasanRows = await pool.query(`
          SELECT pg.id, pg.id_gantt, pg.tanggal_pengawasan, gc.lingkup_pekerjaan
          FROM pengawasan_gantt pg
          JOIN gantt_chart gc ON pg.id_gantt = gc.id
          WHERE pg.id_gantt = ANY($1)
          ORDER BY pg.tanggal_pengawasan ASC
        `, [ganttIds]);
        console.log("Pengawasan Gantt (Tanggal Pengawasan):");
        console.table(pengawasanRows.rows);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}
main();
