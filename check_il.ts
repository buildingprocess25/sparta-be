import { pool } from './src/db/pool';

async function check() {
    const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'instruksi_lapangan'`);
    console.log(res.rows);
    pool.end();
}

check();
