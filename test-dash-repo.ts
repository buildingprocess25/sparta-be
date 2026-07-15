import { dashboardRepository } from './src/modules/dashboard/dashboard.repository';
import { pool } from './src/db/pool';

async function test() {
    const toko = await dashboardRepository.findTokoByQuery({ search: 'a' });
    if (!toko) {
        console.log('Toko not found');
        return;
    }
    console.log('Found toko:', toko.nomor_ulok);
    const dash = await dashboardRepository.findDashboardByTokoId(toko.id);
    if (dash.rab.length > 0) {
        console.log('RAB[0]:', JSON.stringify(dash.rab[0], null, 2));
    }
    if (dash.opname_final.length > 0) {
        console.log('Opname[0]:', JSON.stringify(dash.opname_final[0], null, 2));
    }
    
    // Also test findAllDashboard
    console.log('Testing findAllDashboard...');
    const all = await dashboardRepository.findAllDashboard({ search: 'a' });
    console.log('Total dashboards:', all.length);
    if (all.length > 0) {
        const first = all[0];
        console.log('All Dashboard RAB[0]:', first.rab[0] ? JSON.stringify(first.rab[0], null, 2) : 'No RAB');
    }
    
    await pool.end();
}
test().catch(console.error);
