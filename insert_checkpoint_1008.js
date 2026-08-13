const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/alfamart/SPARTA/sparta-be.env' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function insertCorrectCheckpoint() {
  const client = await pool.connect();
  try {
    const stDate = '10/08/2026'; // Tanggal ST yang benar sesuai screenshot
    const ganttIds = [1017, 1018];
    
    for (const gid of ganttIds) {
      // Check if already exists
      const exist = await client.query(`
        SELECT id FROM pengawasan_gantt 
        WHERE id_gantt = $1 AND tanggal_pengawasan = $2
      `, [gid, stDate]);
      
      if (exist.rowCount === 0) {
        await client.query(`
          INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
          VALUES ($1, $2)
        `, [gid, stDate]);
        console.log(`Inserted checkpoint ${stDate} for gantt ${gid}`);
      } else {
        console.log(`Checkpoint ${stDate} already exists for gantt ${gid}`);
      }
    }
  } finally {
    client.release();
    pool.end();
  }
}

insertCorrectCheckpoint();
