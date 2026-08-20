require('dotenv').config();
const { dashboardRepository } = require('./src/modules/dashboard/dashboard.repository');

async function test() {
    console.log('Fetching dashboard data...');
    const data = await dashboardRepository.findAllDashboard({ search: "" });
    let totalSpk = 0;
    let totalRab = 0;
    for (const project of data) {
        totalSpk += project.spk.length;
        totalRab += project.rab.length;
    }
    console.log('totalSpk:', totalSpk);
    console.log('totalRab:', totalRab);
    console.log('Total Projects:', data.length);
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
