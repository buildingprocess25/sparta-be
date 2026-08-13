const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/alfamart/SPARTA/sparta-be.env' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function executeFix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update Toko
    const tokoRes = await client.query(`
      UPDATE toko SET nama_kontraktor = 'EVLOGIA JAYA, CV' 
      WHERE nomor_ulok = '2SZ1-2508-0005'
      RETURNING id;
    `);
    
    if (tokoRes.rows.length === 0) {
      throw new Error("No toko found with that nomor_ulok!");
    }
    const tokoIds = tokoRes.rows.map(r => r.id);
    console.log("Updated toko IDs:", tokoIds);

    // 2. Update RAB
    const rabRes = await client.query(`
      UPDATE rab SET nama_pt = 'EVLOGIA JAYA, CV', status = 'Ditolak oleh Koordinator' 
      WHERE id_toko = ANY($1)
      RETURNING id;
    `, [tokoIds]);
    console.log("Updated RAB IDs:", rabRes.rows.map(r => r.id));

    // 3. Update SPK
    const spkRes = await client.query(`
      UPDATE pengajuan_spk SET status = 'SPK_REJECTED' 
      WHERE id_toko = ANY($1)
      RETURNING id;
    `, [tokoIds]);
    console.log("Updated SPK IDs:", spkRes.rows.map(r => r.id));

    // 4. Update Gantt Chart
    const ganttRes = await client.query(`
      UPDATE gantt_chart SET status = 'terbuka' 
      WHERE id_toko = ANY($1)
      RETURNING id;
    `, [tokoIds]);
    console.log("Updated Gantt Chart IDs:", ganttRes.rows.map(r => r.id));

    await client.query('COMMIT');
    console.log("TRANSACTION COMMITTED SUCCESSFULLY.");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("TRANSACTION FAILED, ROLLED BACK.", e);
  } finally {
    client.release();
    pool.end();
  }
}
executeFix();
