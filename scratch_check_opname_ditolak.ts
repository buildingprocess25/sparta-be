import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../sparta-be.env' });
import { opnameRepository } from './src/modules/opname/opname.repository';

async function run() {
  try {
    const targetPengawasan = await opnameRepository.findTargetPengawasanForOpnameItem(39341);
    console.log(targetPengawasan);
    if (targetPengawasan && targetPengawasan.id_gantt && targetPengawasan.tanggal_pengawasan) {
        const nextCheckpoint = await opnameRepository.findNextNearestCheckpoint({
            id_gantt: targetPengawasan.id_gantt,
            after_tanggal_pengawasan: targetPengawasan.tanggal_pengawasan,
        });
        console.log("Next checkpoint:", nextCheckpoint);
        if (nextCheckpoint) {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            await pool.query(`UPDATE opname_item SET id_pengawasan_gantt_target = $1 WHERE id = 39341`, [nextCheckpoint.id]);
            console.log("UPDATED!");
            await pool.end();
        }
    }
  } catch (error) {
    console.error(error);
  }
}

run();
