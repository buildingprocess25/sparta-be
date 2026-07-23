import { dashboardRepository } from './src/modules/dashboard/dashboard.repository';
import * as dotenv from 'dotenv';
import { pool } from './src/config/database';

dotenv.config();

async function run() {
    const data = await dashboardRepository.findAllDashboard({ search: 'UZ01-2602-0010' });
    const project = data.find(d => d.toko.lingkup_pekerjaan === 'ME');
    console.log(JSON.stringify(project?.berkas_serah_terima, null, 2));
}

run().finally(() => process.exit(0));
