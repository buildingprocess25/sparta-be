const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(`
    SELECT * FROM user_cabang WHERE email IN ('kusnadi758019@gmail.com', 'santosabudijaya@yahoo.co.id')
`).then(res => {
    console.table(res.rows);
    process.exit(0);
}).catch(console.error);
