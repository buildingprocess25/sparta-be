import { pool } from './src/db/pool';

async function main() {
  try {
    const tokoRows = await pool.query(`
      SELECT id, nomor_ulok, lingkup_pekerjaan 
      FROM toko 
      WHERE nomor_ulok IN ('IZ01-2603-I021-R', 'IZ01-2604-I021-R')
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
      
      const ganttRows = await pool.query(`
        SELECT id, id_toko, status, lingkup_pekerjaan
        FROM gantt_chart
        WHERE id_toko = ANY($1)
      `, [ids]);
      console.log("Gantt Chart:");
      console.table(ganttRows.rows);
    }
  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}
main();
