const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Fix data existing: ubah tipe_opname jadi 'OPNAME_FINAL' untuk semua yang sudah terkunci
// (aksi = 'terkunci'), kecuali yang sudah 'Disetujui' (sudah selesai)
pool.query(`
    UPDATE opname_final
    SET tipe_opname = 'OPNAME_FINAL'
    WHERE aksi = 'terkunci'
    RETURNING id, tipe_opname, aksi, status_opname_final
`).then(res => {
    console.log('Updated rows:', res.rowCount);
    console.table(res.rows);
    process.exit(0);
}).catch(console.error);
