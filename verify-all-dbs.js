const { Client } = require('pg');

async function checkDb(name, dbName, schemaQuery) {
    const url = `postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/${dbName}?sslmode=disable`;
    const client = new Client({ connectionString: url });
    
    try {
        await client.connect();
        const res = await client.query(schemaQuery);
        console.log(`✅ [${name}] Database connected!`);
        console.log(`   Sample Data / Schema:`, res.rows[0]);
    } catch (e) {
        console.log(`❌ [${name}] Database connection failed:`, e.message);
    } finally {
        await client.end();
    }
}

async function main() {
    console.log("Starting DB Verification across 3 modules...");
    
    // 1. Building DB
    await checkDb(
        "Building (sparta-be)", 
        "building", 
        "SELECT email_sat, cabang, nama_lengkap FROM user_cabang LIMIT 1;"
    );

    // 2. Maintenance DB
    await checkDb(
        "Maintenance", 
        "maintenance", 
        'SELECT email, "spartaUserId", role, "mustChangePassword" FROM "User" LIMIT 1;'
    );

    // 3. Energy DB
    await checkDb(
        "Energy", 
        "energy", 
        "SELECT email, password_hash, role FROM users LIMIT 1;"
    );
}

main();
