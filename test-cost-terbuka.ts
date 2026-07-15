import { dashboardRepository } from './src/modules/dashboard/dashboard.repository';
import { pool } from './src/db/pool';

async function test() {
    const all = await dashboardRepository.findAllDashboard({ search: '' });
    for (const dash of all) {
        if (dash.rab && dash.rab.length > 0) {
            for (const r of dash.rab) {
                if (Number(r.luas_area_terbuka) > 0) {
                    console.log(`Toko: ${dash.toko?.nomor_ulok}, RAB ID: ${r.id}, luas_terbuka: ${r.luas_area_terbuka}, cost_terbuka: ${r.cost_terbuka}`);
                    if (Number(r.cost_terbuka) === 0) {
                        // Check if it has area terbuka items in DB
                        const items = await pool.query(`SELECT id, kategori_pekerjaan, total_harga FROM rab_item WHERE id_rab = $1 AND UPPER(kategori_pekerjaan) = 'PEKERJAAN AREA TERBUKA'`, [r.id]);
                        console.log(`  -> Items in DB: ${items.rowCount}`);
                        if (items.rowCount > 0) {
                            console.log(`  -> Total Harga for first item: ${items.rows[0].total_harga}`);
                        }
                    }
                    return;
                }
            }
        }
    }
    
    await pool.end();
}
test().catch(console.error);
