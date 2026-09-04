const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

async function main() {
    try {
        // Find users with more than 1 branch
        const resBranch = await pool.query(`
            SELECT email, COUNT(DISTINCT branch_id) as branch_count
            FROM user_branches
            GROUP BY email
            HAVING COUNT(DISTINCT branch_id) > 1
            LIMIT 5;
        `);
        console.log('--- >1 BRANCH (BUILDING) ---');
        console.table(resBranch.rows);

        // Find users with more than 1 role
        const resRole = await pool.query(`
            SELECT email, COUNT(DISTINCT role_id) as role_count
            FROM user_roles
            GROUP BY email
            HAVING COUNT(DISTINCT role_id) > 1
            LIMIT 5;
        `);
        console.log('\n--- >1 ROLE (BUILDING) ---');
        console.table(resRole.rows);

    } catch (err) {
        console.error('Error:', err.message);
        
        // If tables are named differently, try to query information schema to find them
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE '%user%';
        `);
        console.log('Available user tables:', tables.rows.map(r => r.table_name));
    } finally {
        await pool.end();
    }
}
main();
