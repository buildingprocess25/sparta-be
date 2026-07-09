const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update nomor_ulok wherever it exists for id_toko 1867
    console.log("Updating nomor_ulok to HZ01-2605-H579-R for id_toko 1867...");

    await client.query("UPDATE pengajuan_spk SET nomor_ulok = 'HZ01-2605-H579-R' WHERE id_toko = 1867");
    await client.query("UPDATE pic_pengawasan SET nomor_ulok = 'HZ01-2605-H579-R' WHERE id_toko = 1867");

    // Let's also check if other tables have nomor_ulok and id_toko
    const checkTables = ['berkas_serah_terima', 'opname_final', 'instruksi_lapangan'];
    for (const table of checkTables) {
      try {
        await client.query(`UPDATE ${table} SET nomor_ulok = 'HZ01-2605-H579-R' WHERE id_toko = 1867`);
      } catch (err) {
        // Ignore if column doesn't exist
      }
    }

    await client.query('COMMIT');
    console.log("SUCCESS");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
