import fs from 'fs';
import path from 'path';
import { pool } from './src/db/pool';

async function migrate() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'sql', '2026-06-09-add-tipe-opname.sql'), 'utf-8');
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration successful.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
