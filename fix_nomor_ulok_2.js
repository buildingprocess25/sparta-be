const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    // We will do them one by one without BEGIN/COMMIT so that a failure in one doesn't abort others
    console.log("Updating nomor_ulok to HZ01-2605-H579-R for id_toko 1867...");

    const res1 = await pool.query("UPDATE pengajuan_spk SET nomor_ulok = 'HZ01-2605-H579-R' WHERE id_toko = 1867");
    console.log("pengajuan_spk updated:", res1.rowCount);
    
    const res2 = await pool.query("UPDATE pic_pengawasan SET nomor_ulok = 'HZ01-2605-H579-R' WHERE id_toko = 1867");
    console.log("pic_pengawasan updated:", res2.rowCount);

    const checkTables = ['berkas_serah_terima', 'opname_final', 'instruksi_lapangan'];
    for (const table of checkTables) {
      try {
        const res = await pool.query(`UPDATE ${table} SET nomor_ulok = 'HZ01-2605-H579-R' WHERE id_toko = 1867`);
        console.log(`${table} updated:`, res.rowCount);
      } catch (err) {
        console.log(`${table} failed or skipped`);
      }
    }

    console.log("SUCCESS");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
