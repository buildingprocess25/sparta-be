require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: String(process.env.DB_PASSWORD),
    port: process.env.DB_PORT,
});

async function main() {
    try {
        const result = await pool.query(`
            SELECT id, email_pembuat, volume_akhir, jenis_pekerjaan, approval_status 
            FROM opname_final 
            WHERE volume_akhir > 1000
        `);
        console.log('Result:', result.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
