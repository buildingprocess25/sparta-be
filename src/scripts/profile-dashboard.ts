import { pool } from '../db/pool';
import { dashboardRepository } from '../modules/dashboard/dashboard.repository';

async function run() {
    const t = Date.now();
    console.log('Running findAllDashboard...');
    try {
        const data = await dashboardRepository.findAllDashboard({});
        console.log(`Done! ${data.length} projects in ${Date.now() - t}ms`);
    } finally {
        await pool.end();
    }
}
run().catch(e => { console.error(e.message); process.exit(1); });
