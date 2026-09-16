const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runQueries() {
  try {
    const userQuery = await pool.query(`SELECT * FROM user_cabang WHERE email_sat = 'eko.i.nugraha@sat.co.id'`);
    const u = userQuery.rows[0];
    console.log("User:", u.nama_lengkap, u.jabatan, u.cabang);
    
    // Simulate what queryNotificationRows does for PP:
    // statusConditions.push("pp.status = 'WAITING_PP_MANAGER_APPROVAL'")
    // Let's see if WAITING_PP_APPROVAL_1 is somehow returned?
    const q1 = await pool.query(`
        SELECT
            'PROJECT_PLANNING' AS entity_type,
            pp.id AS entity_id,
            pp.id_toko,
            COALESCE(pp.nama_toko, pp.nama_lokasi, pp.nomor_ulok) AS title,
            pp.nomor_ulok,
            pp.lingkup_pekerjaan,
            pp.cabang,
            pp.status,
            COUNT(*) OVER() AS total_count
        FROM projek_planning pp
        WHERE pp.status = 'WAITING_PP_MANAGER_APPROVAL'
    `);
    console.log("WAITING_PP_MANAGER_APPROVAL count:", q1.rows.length);
    
    const q2 = await pool.query(`
        SELECT
            'PROJECT_PLANNING' AS entity_type,
            pp.id AS entity_id,
            pp.id_toko,
            COALESCE(pp.nama_toko, pp.nama_lokasi, pp.nomor_ulok) AS title,
            pp.nomor_ulok,
            pp.lingkup_pekerjaan,
            pp.cabang,
            pp.status,
            COUNT(*) OVER() AS total_count
        FROM projek_planning pp
        WHERE pp.status = 'WAITING_PP_APPROVAL_1'
    `);
    console.log("WAITING_PP_APPROVAL_1 items:", q2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

runQueries();
