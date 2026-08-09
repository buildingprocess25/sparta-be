const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const { execSync } = require('child_process');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Creating temp tables...');
    await client.query(`
      DROP TABLE IF EXISTS temp_kategori_pekerjaan_gantt CASCADE;
      DROP TABLE IF EXISTS temp_day_gantt_chart CASCADE;

      CREATE TABLE temp_kategori_pekerjaan_gantt (
        id integer NOT NULL,
        id_gantt integer,
        kategori_pekerjaan character varying(255)
      );

      CREATE TABLE temp_day_gantt_chart (
        id integer NOT NULL,
        id_gantt integer,
        id_kategori_pekerjaan_gantt integer,
        h_awal character varying(50),
        h_akhir character varying(50),
        keterlambatan character varying(50),
        kecepatan character varying(50)
      );
    `);
    console.log('Temp tables created.');
  } finally {
    client.release();
  }

  // Load the SQL
  console.log('Loading kpg_temp.sql...');
  execSync(`"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" "${process.env.DATABASE_URL}" -f "C:\\alfamart\\SPARTA\\sparta-be\\kpg_temp.sql"`);

  console.log('Loading dgc_temp.sql...');
  execSync(`"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" "${process.env.DATABASE_URL}" -f "C:\\alfamart\\SPARTA\\sparta-be\\dgc_temp.sql"`);

  const client2 = await pool.connect();
  try {
    console.log('Checking max ID in temp vs main...');
    const maxKpgTemp = await client2.query('SELECT MAX(id) as max_id FROM temp_kategori_pekerjaan_gantt');
    console.log(`Max KPG ID in backup: ${maxKpgTemp.rows[0].max_id}`);

    const maxKpgMain = await client2.query('SELECT MAX(id) as max_id FROM kategori_pekerjaan_gantt');
    console.log(`Max KPG ID in current DB: ${maxKpgMain.rows[0].max_id}`);

    console.log('Identifying divergent Gantt charts...');
    const result = await client2.query(`
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
      SELECT c.id_gantt, t.temp_hash, c.current_hash
      FROM CurrentData c
      JOIN TempData t ON t.id_gantt = c.id_gantt
      WHERE c.current_hash != t.temp_hash
    `, [maxKpgTemp.rows[0].max_id]);

    console.log(`Found ${result.rowCount} divergent Gantt charts.`);
    if (result.rowCount > 0) {
      console.log('Divergent Gantt IDs:', result.rows.map(r => r.id_gantt));
      fs.writeFileSync('divergent-gantts.json', JSON.stringify(result.rows, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    client2.release();
    pool.end();
  }
}

run();
