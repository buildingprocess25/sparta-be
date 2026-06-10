const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(`UPDATE gantt_chart SET timestamp = '2025-12-29' WHERE id = 651 RETURNING id, timestamp`)
    .then(r => { console.log("Fixed:", r.rows[0]); pool.end(); })
    .catch(e => { console.error(e.message); pool.end(); });
