require('dotenv').config();
const { pool } = require('./src/db/pool');

(async () => {
    try {
        const res = await pool.query('SELECT COUNT(*) FROM dc_archive_project');
        console.log('Archive projects:', res.rows[0].count);
        
        const res2 = await pool.query('SELECT COUNT(*) FROM dc_project');
        console.log('Projects:', res2.rows[0].count);

        const res3 = await pool.query('SELECT COUNT(*) FROM dc_document');
        console.log('Documents:', res3.rows[0].count);
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
        process.exit();
    }
})();
