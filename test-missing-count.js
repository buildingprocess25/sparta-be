const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkMissing() {
    const res = await pool.query(`
        WITH pengawasan_per_date AS (
            SELECT DISTINCT ON (
                p.id_gantt,
                p.id_pengawasan_gantt,
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
            )
                p.*,
                tpg.tanggal_pengawasan AS tpg_tanggal_pengawasan
            FROM pengawasan p
            JOIN target_pengawasan_gantt tpg ON tpg.id_pengawasan_gantt = p.id_pengawasan_gantt
            WHERE p.id_gantt IN (548, 550)
            ORDER BY
                p.id_gantt,
                p.id_pengawasan_gantt,
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                p.id DESC
        ),
        latest_overall_status AS (
            SELECT DISTINCT ON (
                id_gantt,
                UPPER(TRIM(COALESCE(kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(jenis_pekerjaan, '')))
            )
                id_gantt,
                status,
                tpg_tanggal_pengawasan
            FROM pengawasan_per_date
            ORDER BY
                id_gantt,
                UPPER(TRIM(COALESCE(kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(jenis_pekerjaan, ''))),
                to_date(tpg_tanggal_pengawasan, 'DD/MM/YYYY') DESC,
                id DESC
        )
        SELECT status, count(*) 
        FROM latest_overall_status 
        GROUP BY status
    `);
    console.log(res.rows);
    pool.end();
}
checkMissing();
