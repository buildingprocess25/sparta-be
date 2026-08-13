const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/alfamart/SPARTA/sparta-be.env' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function queryPengawasan1008() {
  const client = await pool.connect();
  try {
    const ganttIds = [1017, 1018];
    const stDate = '10/08/2026';
    
    const cpRes = await client.query(`
      SELECT id, tanggal_pengawasan 
      FROM pengawasan_gantt 
      WHERE id_gantt = ANY($1) AND tanggal_pengawasan = $2
    `, [ganttIds, stDate]);
    
    console.log("Checkpoints on 10/08:");
    console.table(cpRes.rows);
    
    if (cpRes.rows.length > 0) {
      const cpIds = cpRes.rows.map(r => r.id);
      const pRes = await client.query(`
        SELECT id, id_gantt, kategori_pekerjaan, status, created_at 
        FROM pengawasan 
        WHERE id_pengawasan_gantt = ANY($1)
      `, [cpIds]);
      console.log("\\nPengawasan Items on 10/08:");
      console.table(pRes.rows);
    }
    
  } finally {
    client.release();
    pool.end();
  }
}

queryPengawasan1008();
