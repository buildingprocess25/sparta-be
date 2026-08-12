import fs from 'fs';
import { pool } from './src/db/pool';
import path from 'path';

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'sql', '2026-08-12-create-toko-kpi-metrics.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration ran successfully!');
    } catch (e) {
        console.error('Error running migration:', e);
    } finally {
        await pool.end();
    }
}

run();
