const { Client } = require('pg');

async function getRoles(name, dbName, queryStr) {
    const url = `postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/${dbName}?sslmode=disable`;
    const client = new Client({ connectionString: url });
    
    try {
        await client.connect();
        const res = await client.query(queryStr);
        console.log(`\n📌 Sample Role - ${name}:`);
        res.rows.forEach(r => {
            console.log(`  - Role: ${r.role_name.padEnd(35)} | Email: ${r.email}`);
        });
    } catch (e) {
        console.log(`❌ [${name}] Failed:`, e.message);
    } finally {
        await client.end();
    }
}

async function main() {
    await getRoles(
        "Building (sparta-be)", 
        "building", 
        "SELECT jabatan as role_name, MAX(email_sat) as email FROM user_cabang WHERE jabatan IS NOT NULL AND jabatan != '' GROUP BY jabatan ORDER BY jabatan LIMIT 5;"
    );

    await getRoles(
        "Maintenance", 
        "maintenance", 
        'SELECT role as role_name, MAX(email) as email FROM "User" GROUP BY role ORDER BY role LIMIT 5;'
    );

    await getRoles(
        "Energy", 
        "energy", 
        "SELECT role as role_name, MAX(email) as email FROM users GROUP BY role ORDER BY role LIMIT 5;"
    );
}

main();
