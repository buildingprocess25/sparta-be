const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateProxy() {
    await pool.query('BEGIN');
    try {
        console.log('=== UPDATE DOKUMEN PROXY 14 ITEM ME DI 26 JUNI ===');

        const proxyUrl = 'https://s3.ap-southeast-3.amazonaws.com/sparta.alfamart.com/dummy-proxy-document.pdf';
        
        const res = await pool.query(`
            UPDATE pengawasan
            SET dokumentasi = $1
            WHERE id_pengawasan_gantt = 899 AND status = 'progress'
            RETURNING id
        `, [proxyUrl]);

        console.log(`Berhasil mengubah ${res.rowCount} record 'progress' dengan dokumen proxy.`);
        await pool.query('COMMIT');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error(e);
    } finally {
        pool.end();
    }
}

updateProxy();
