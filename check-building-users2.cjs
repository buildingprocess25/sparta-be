const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
    try {
        // Users with multiple branches in user_branch_coverage
        const res1 = await pool.query(`
            SELECT uc.email_sat, uc.jabatan, uc.cabang as primary_cabang, COUNT(ubc.id) as extra_branches
            FROM user_cabang uc
            JOIN user_branch_coverage ubc ON uc.id = ubc.user_cabang_id
            GROUP BY uc.id, uc.email_sat, uc.jabatan, uc.cabang
            HAVING COUNT(ubc.id) > 0
            LIMIT 5;
        `);
        console.log('--- >1 CABANG (user_branch_coverage) ---');
        console.table(res1.rows);

        // Users with multiple rows in user_cabang (maybe multiple roles?)
        const res2 = await pool.query(`
            SELECT email_sat, COUNT(DISTINCT cabang) as count_cabang, COUNT(DISTINCT jabatan) as count_jabatan
            FROM user_cabang
            GROUP BY email_sat
            HAVING COUNT(DISTINCT jabatan) > 1 OR COUNT(DISTINCT cabang) > 1
            LIMIT 5;
        `);
        console.log('\n--- >1 CABANG/ROLE (user_cabang rows) ---');
        console.table(res2.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
