import { pool } from "./src/db/pool";
import { dashboardRepository } from "./src/modules/dashboard/dashboard.repository";

async function run() {
    console.log("Benchmarking current findAllDashboard...");
    const t0 = Date.now();
    const data = await dashboardRepository.findAllDashboard({});
    console.log(`Finished in ${Date.now() - t0}ms. Rows: ${data.length}`);
    await pool.end();
}
run().catch(console.error);
