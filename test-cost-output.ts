import { dashboardRepository } from './src/modules/dashboard/dashboard.repository';
import { pool } from './src/db/pool';

async function test() {
    const all = await dashboardRepository.findAllDashboard({ search: '' });
    console.log('Total dashboards:', all.length);
    
    let found = 0;
    for (const dash of all) {
        if (dash.rab && dash.rab.length > 0) {
            for (const r of dash.rab) {
                if (Number(r.cost_terbuka) > 0) {
                    console.log(`Toko: ${dash.toko?.nomor_ulok}, RAB ID: ${r.id}, cost_terbuka: ${r.cost_terbuka}, cost_bangunan: ${r.cost_bangunan}`);
                    found++;
                }
            }
        }
        if (found > 5) break;
    }
    
    await pool.end();
}
test().catch(console.error);
