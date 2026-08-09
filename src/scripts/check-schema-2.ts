import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const client = await pool.connect();
        
        const res = await client.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name ILIKE '%koordinator%' OR column_name ILIKE '%support%'
        `);
        
        console.log(res.rows);
        
        client.release();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
