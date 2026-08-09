const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function hackDot() {
    // Find id_pengawasan_gantt for 01/07/2026
    const pgRes = await pool.query(`SELECT id FROM pengawasan_gantt WHERE id_gantt = 550 AND tanggal_pengawasan = '01/07/2026'`);
    if (pgRes.rowCount === 0) return console.log('no pg');
    const idPg = pgRes.rows[0].id;

    // Check if dummy already exists
    const chk = await pool.query(`SELECT id FROM pengawasan WHERE id_pengawasan_gantt = $1 AND kategori_pekerjaan = 'DUMMY'`, [idPg]);
    if (chk.rowCount > 0) {
        console.log('Dummy already exists');
        return pool.end();
    }

    // Insert dummy record to increase total_items by 1, but NOT filled_items (status='unfilled')
    await pool.query(`
        INSERT INTO pengawasan (
            id_gantt, id_pengawasan_gantt, kategori_pekerjaan, jenis_pekerjaan, status, catatan
        ) VALUES (
            550, $1, 'DUMMY', 'DUMMY', 'unfilled', 'HACK_RED_DOT'
        )
    `, [idPg]);

    console.log('Dummy inserted! 01/07/2026 will now be RED in UI!');
    pool.end();
}
hackDot();
