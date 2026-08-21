const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Sync SPK dates
    await client.query(`
      UPDATE pengajuan_spk 
      SET waktu_mulai = '2026-05-28T17:00:00.000Z', 
          waktu_selesai = '2026-06-13T00:00:00.000Z'
      WHERE id = 262
    `);
    console.log('SPK 262 updated');

    // 2. Sync PIC Pengawasan
    await client.query(`
      UPDATE pic_pengawasan
      SET tanggal_mulai_spk = '2026-05-29'
      WHERE id = 195
    `);
    console.log('PIC Pengawasan 195 updated');

    // 3. Shift Gantt Chart pengawasan dates by -6 days
    const peng = await client.query(`SELECT id, tanggal_pengawasan FROM pengawasan_gantt WHERE id_gantt = 216`);
    for (const row of peng.rows) {
      // Parse DD/MM/YYYY
      const parts = row.tanggal_pengawasan.split('/');
      const date = new Date(Date.UTC(parts[2], parseInt(parts[1]) - 1, parts[0]));
      
      // Shift by -6 days
      date.setUTCDate(date.getUTCDate() - 6);
      
      // Format back to DD/MM/YYYY
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = date.getUTCFullYear();
      const newStr = `${dd}/${mm}/${yyyy}`;
      
      await client.query(`UPDATE pengawasan_gantt SET tanggal_pengawasan = $1 WHERE id = $2`, [newStr, row.id]);
      console.log(`Pengawasan Gantt ${row.id} shifted from ${row.tanggal_pengawasan} to ${newStr}`);
    }

    await client.query('COMMIT');
    console.log('Sync COMMITTED successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction FAILED, rolled back.', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
