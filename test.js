const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(`
    SELECT r.id, r.pemberi_persetujuan_koordinator, r.pemberi_persetujuan_manager
    FROM rab r
    WHERE r.id = 2233
`).then(res => {
    console.table(res.rows);
    process.exit(0);
}).catch(console.error);
