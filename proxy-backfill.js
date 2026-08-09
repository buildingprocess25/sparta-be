const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function proxyBackfill() {
    await pool.query('BEGIN');
    try {
        console.log('=== MEMULAI PROXY BACKFILL 14 ITEM ME DI 26 JUNI ===');

        const proxyUrl = 'https://s3.ap-southeast-3.amazonaws.com/sparta.alfamart.com/dummy-proxy-document.pdf';
        
        // Ambil daftar 14 item unik ME dari riwayat pengawasan
        const meItemsRes = await pool.query(`
            SELECT DISTINCT kategori_pekerjaan, jenis_pekerjaan
            FROM pengawasan p
            JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            WHERE pg.id_gantt = 550
        `);
        
        const items = meItemsRes.rows;
        console.log(`Ditemukan ${items.length} item ME unik.`);
        
        let inserted = 0;
        for (const item of items) {
            // Pastikan belum ada di tanggal 26/06/2026 (id 899)
            const cekRes = await pool.query(`
                SELECT id FROM pengawasan 
                WHERE id_pengawasan_gantt = 899 
                AND kategori_pekerjaan = $1 
                AND jenis_pekerjaan = $2
            `, [item.kategori_pekerjaan, item.jenis_pekerjaan]);
            
            if (cekRes.rowCount === 0) {
                await pool.query(`
                    INSERT INTO pengawasan (
                        id_gantt,
                        id_pengawasan_gantt,
                        kategori_pekerjaan,
                        jenis_pekerjaan,
                        status,
                        dokumentasi,
                        bukti_foto_1,
                        catatan
                    ) VALUES (
                        550,
                        899,
                        $1,
                        $2,
                        'progress',
                        $3,
                        $3,
                        'Dokumen disisipkan secara proxy (backfill)'
                    )
                `, [item.kategori_pekerjaan, item.jenis_pekerjaan, proxyUrl]);
                inserted++;
                console.log(`  [INSERT PROGRESS PROXY] ME | ${item.jenis_pekerjaan.substring(0, 40)}`);
            }
        }

        console.log(`\nBerhasil menambahkan ${inserted} record 'progress' (dengan dokumen proxy) untuk 26/06/2026.`);
        await pool.query('COMMIT');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error(e);
    } finally {
        pool.end();
    }
}

proxyBackfill();
