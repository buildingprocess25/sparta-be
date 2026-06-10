const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function patch() {
    // Patch data yang sudah masuk tapi alamat/kontraktor kosong
    const res = await pool.query(`
        UPDATE toko SET 
            alamat = 'Alam Sutera',
            nama_kontraktor = 'PT KONTRAKTOR'
        WHERE nomor_ulok = 'Z001-2512-6969' AND lingkup_pekerjaan = 'SIPIL'
        RETURNING id, nomor_ulok, alamat, nama_kontraktor
    `);
    console.log("Patched:", res.rows[0]);

    // Patch timestamp gantt_chart
    const ganttRes = await pool.query(`
        UPDATE gantt_chart SET timestamp = '2025-12-29'
        WHERE id_toko = (SELECT id FROM toko WHERE nomor_ulok = 'Z001-2512-6969' AND lingkup_pekerjaan = 'SIPIL' LIMIT 1)
        RETURNING id, timestamp
    `);
    console.log("Gantt timestamp patched:", ganttRes.rows[0]);

    pool.end();
}
patch();
