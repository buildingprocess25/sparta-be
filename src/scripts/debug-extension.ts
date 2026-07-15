import { pool } from '../db/pool';
import { ganttRepository } from '../modules/gantt/gantt.repository';

async function run() {
    try {
        const rows = await ganttRepository.findSupervisionWorkspace('2SZ1-2603-0006');
        console.log("Result count:", rows.length);
        for (const r of rows) {
            console.log(`[${r.lingkup_pekerjaan}] spk_duration=${r.spk_duration}, spk_effective_duration=${r.spk_effective_duration}, spk_effective_end_date=${r.spk_effective_end_date}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();
