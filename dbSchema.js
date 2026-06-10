const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = `
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_name IN ('toko','gantt_chart','kategori_pekerjaan_gantt','day_gantt_chart','dependency_gantt','pengawasan_gantt')
  ORDER BY table_name, ordinal_position
`;

pool.query(sql).then(r => {
    let currentTable = '';
    r.rows.forEach(row => {
        if (row.table_name !== currentTable) {
            currentTable = row.table_name;
            console.log(`\n=== TABLE: ${currentTable} ===`);
        }
        console.log(`  ${row.column_name.padEnd(35)} ${row.data_type}`);
    });
    pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
