import { pool } from './src/db/pool';

async function main() {
  try {
    const rabs = await pool.query(`
      SELECT id, nomor_ulok, kategori, jenis_pekerjaan, status, status_approval, durasi_pekerjaan, deleted_at 
      FROM "RabList" 
      WHERE nomor_ulok IN ('IZ01-2603-I021-R', 'IZ01-2604-I021-R')
    `);
    console.log("RabList:");
    console.table(rabs.rows);

    const gantts = await pool.query(`
      SELECT id, nomor_ulok, jenis_pekerjaan, estimasi_durasi, deleted_at 
      FROM "Gantt" 
      WHERE nomor_ulok IN ('IZ01-2603-I021-R', 'IZ01-2604-I021-R')
    `);
    if (gantts.rows.length > 0) {
        console.log("Gantt:");
        console.table(gantts.rows);
    }
    
    // Also check Opname just in case there are records
    const opname = await pool.query(`
      SELECT id, nomor_ulok, deleted_at 
      FROM "Opname" 
      WHERE nomor_ulok IN ('IZ01-2603-I021-R', 'IZ01-2604-I021-R')
    `);
    if (opname.rows.length > 0) {
        console.log("Opname:");
        console.table(opname.rows);
    }
  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}
main();
