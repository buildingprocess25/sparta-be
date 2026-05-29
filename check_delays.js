const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT d.id, d.kategori_pekerjaan, d.keterlambatan, t.nama_toko 
      FROM day_gantt_chart d 
      JOIN gantt_chart g ON g.id = d.id_gantt 
      JOIN toko t ON t.id = g.id_toko 
      WHERE t.nama_toko ILIKE '%wenang%' 
      AND d.keterlambatan IS NOT NULL 
      AND d.keterlambatan != ''
      AND d.keterlambatan != '0'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
