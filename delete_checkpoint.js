const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/alfamart/SPARTA/sparta-be.env' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function deleteCheckpoint() {
  const client = await pool.connect();
  try {
    const today = '12/08/2026'; 
    const ganttIds = [1017, 1018];
    
    await client.query(`
      DELETE FROM pengawasan_gantt 
      WHERE id_gantt = ANY($1) AND tanggal_pengawasan = $2
    `, [ganttIds, today]);
    console.log(`Deleted checkpoint ${today} for gantt 1017, 1018`);
    
  } finally {
    client.release();
    pool.end();
  }
}

deleteCheckpoint();
