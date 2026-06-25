const { Pool } = require('pg');
const { env } = require('./src/config/env');
const pool = new Pool({
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
});

async function main() {
    try {
        const result = await pool.query(`
            SELECT id, id_toko, email_pembuat, volume_akhir, jenis_pekerjaan 
            FROM opname_final 
            WHERE jenis_pekerjaan LIKE '%Partisi gypsum%' AND volume_akhir > 1000
        `);
        console.log('Result:', result.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
