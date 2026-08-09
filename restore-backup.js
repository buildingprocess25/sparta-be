const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const maxKpgTemp = await client.query('SELECT MAX(id) as max_id FROM temp_kategori_pekerjaan_gantt');
    const maxId = maxKpgTemp.rows[0].max_id;

    console.log('Identifying divergent Gantt charts...');
    const result = await client.query(`
      WITH 
      TempData AS (
        SELECT t_k.id_gantt, string_agg(t_k.id || ':' || COALESCE(t_k.kategori_pekerjaan,'') || ':' || COALESCE(t_d.h_awal, '') || ':' || COALESCE(t_d.h_akhir, ''), ',' ORDER BY t_k.id) as temp_hash
        FROM temp_kategori_pekerjaan_gantt t_k
        LEFT JOIN temp_day_gantt_chart t_d ON t_d.id_kategori_pekerjaan_gantt = t_k.id
        GROUP BY t_k.id_gantt
      ),
      CurrentData AS (
        SELECT m_k.id_gantt, string_agg(m_k.id || ':' || COALESCE(m_k.kategori_pekerjaan,'') || ':' || COALESCE(m_d.h_awal, '') || ':' || COALESCE(m_d.h_akhir, ''), ',' ORDER BY m_k.id) as current_hash
        FROM kategori_pekerjaan_gantt m_k
        LEFT JOIN day_gantt_chart m_d ON m_d.id_kategori_pekerjaan_gantt = m_k.id
        WHERE m_k.id <= $1
        GROUP BY m_k.id_gantt
      )
      SELECT c.id_gantt
      FROM CurrentData c
      JOIN TempData t ON t.id_gantt = c.id_gantt
      WHERE c.current_hash != t.temp_hash
    `, [maxId]);

    const divergentIds = result.rows.map(r => r.id_gantt);
    console.log(`Found ${divergentIds.length} divergent Gantt charts.`);

    if (divergentIds.length === 0) {
      console.log('No divergent Gantt charts found. Nothing to restore.');
      return;
    }

    console.log('Starting restoration transaction...');
    await client.query('BEGIN');

    // Delete day_gantt_chart for these Gantt IDs (we delete based on id_kategori_pekerjaan_gantt)
    await client.query(`
      DELETE FROM day_gantt_chart 
      WHERE id_kategori_pekerjaan_gantt IN (
        SELECT id FROM kategori_pekerjaan_gantt WHERE id_gantt = ANY($1::int[]) AND id <= $2
      )
    `, [divergentIds, maxId]);

    // Delete kategori_pekerjaan_gantt for these Gantt IDs
    await client.query(`
      DELETE FROM kategori_pekerjaan_gantt 
      WHERE id_gantt = ANY($1::int[]) AND id <= $2
    `, [divergentIds, maxId]);

    // Insert from temp tables
    await client.query(`
      INSERT INTO kategori_pekerjaan_gantt (id, id_gantt, kategori_pekerjaan)
      SELECT id, id_gantt, kategori_pekerjaan 
      FROM temp_kategori_pekerjaan_gantt 
      WHERE id_gantt = ANY($1::int[])
    `, [divergentIds]);

    await client.query(`
      INSERT INTO day_gantt_chart (id, id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan)
      SELECT id, id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan
      FROM temp_day_gantt_chart 
      WHERE id_kategori_pekerjaan_gantt IN (
        SELECT id FROM temp_kategori_pekerjaan_gantt WHERE id_gantt = ANY($1::int[])
      )
    `, [divergentIds]);

    await client.query('COMMIT');
    console.log('Restoration completed successfully.');

    console.log('Dropping temp tables...');
    await client.query('DROP TABLE temp_kategori_pekerjaan_gantt CASCADE;');
    await client.query('DROP TABLE temp_day_gantt_chart CASCADE;');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error during restoration, rolled back:', e);
  } finally {
    client.release();
    pool.end();
  }
}

run();
