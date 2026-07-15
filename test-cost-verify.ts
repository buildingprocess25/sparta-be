import { dashboardRepository } from './src/modules/dashboard/dashboard.repository';
import { pool } from './src/db/pool';

async function test() {
    const all = await dashboardRepository.findAllDashboard({ search: '' });
    console.log('Total dashboards:', all.length);
    
    let foundTerbuka = 0;
    let foundBangunan = 0;
    
    for (const dash of all) {
        for (const r of (dash.rab || [])) {
            const ct = Number((r as any).cost_terbuka);
            const cb = Number((r as any).cost_bangunan);
            if (ct > 0) foundTerbuka++;
            if (cb > 0) foundBangunan++;
        }
    }
    
    console.log(`RABs with cost_terbuka > 0: ${foundTerbuka}`);
    console.log(`RABs with cost_bangunan > 0: ${foundBangunan}`);
    
    // Print first example
    for (const dash of all) {
        for (const r of (dash.rab || [])) {
            const ct = Number((r as any).cost_terbuka);
            if (ct > 0) {
                console.log('Example RAB with cost_terbuka:', {
                    id: r.id,
                    nomor_ulok: dash.toko?.nomor_ulok,
                    cost_terbuka: (r as any).cost_terbuka,
                    cost_bangunan: (r as any).cost_bangunan,
                    cost_beanspot: (r as any).cost_beanspot,
                    luas_area_terbuka: r.luas_area_terbuka
                });
                break;
            }
        }
        break;
    }
    
    await pool.end();
}
test().catch(console.error);
