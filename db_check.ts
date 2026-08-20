import { Client } from 'pg';

const client = new Client({
    connectionString: "postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable",
});

async function main() {
    await client.connect();
    
    console.log("=== CHECKING CABANG VALUES ===");
    // Get unique branches from rab or spk or opname (let's check a main table like rab)
    try {
        const res = await client.query(`SELECT DISTINCT cabang FROM rab LIMIT 100;`);
        console.log("Unique Cabang in RAB:", res.rows.map(r => r.cabang));
    } catch(e: any) { console.error("Error RAB:", e.message); }

    try {
        const res = await client.query(`SELECT DISTINCT proyek FROM rab LIMIT 100;`);
        console.log("Unique Proyek in RAB:", res.rows.map(r => r.proyek));
    } catch(e: any) { console.error("Error Proyek:", e.message); }
    
    console.log("=== CHECKING TABLE SCHEMA ===");
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'rab' 
            AND (column_name LIKE '%cabang%' OR column_name LIKE '%proyek%');
        `);
        console.log("Columns related to cabang/proyek in RAB:", res.rows);
    } catch (e: any) { console.error(e.message); }

    await client.end();
}

main().catch(console.error);
