import { ganttService } from '../modules/gantt/gantt.service';
import { pool } from '../db/pool';

async function run() {
    try {
        const result = await ganttService.getSupervisionWorkspace('2SZ1-2603-0006');
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();
