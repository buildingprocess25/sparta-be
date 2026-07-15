import { dashboardRepository } from './src/modules/dashboard/dashboard.repository';
import { pool } from './src/db/pool';

async function test() {
    const all = await dashboardRepository.findAllDashboard({ search: '' });
    
    let opTerbuka = 0;
    let opBangunan = 0;
    let totalOp = 0;
    
    for (const dash of all) {
        for (const r of (dash.opname_final || [])) {
            totalOp++;
            const ct = Number((r as any).cost_terbuka);
            const cb = Number((r as any).cost_bangunan);
            if (ct > 0) opTerbuka++;
            if (cb > 0) opBangunan++;
        }
    }
    
    console.log(`Total Opname Final: ${totalOp}`);
    console.log(`Opnames with cost_terbuka > 0: ${opTerbuka}`);
    console.log(`Opnames with cost_bangunan > 0: ${opBangunan}`);
    
    await pool.end();
}
test().catch(console.error);
