const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
    try {
        const c1 = await pool.query(`SELECT * FROM user_cabang LIMIT 1`);
        console.log('user_cabang columns:', c1.fields.map(f => f.name));
        
        const c2 = await pool.query(`SELECT * FROM user_branch_coverage LIMIT 1`);
        console.log('user_branch_coverage columns:', c2.fields.map(f => f.name));
        
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE '%role%';
        `);
        console.log('Available role tables:', tables.rows.map(r => r.table_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
