require('dotenv').config();
const { dashboardRepository } = require('./src/modules/dashboard/dashboard.repository');

async function test() {
    console.time('findAllDashboard');
    const data = await dashboardRepository.findAllDashboard({ search: "" });
    console.timeEnd('findAllDashboard');
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
