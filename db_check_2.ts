import { Client } from 'pg';

const client = new Client({
    connectionString: "postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable",
});

async function main() {
    await client.connect();
    
    console.log("=== CHECKING TABLE SCHEMA for TOKO ===");
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'toko' 
            AND (column_name LIKE '%cabang%' OR column_name LIKE '%proyek%');
        `);
        console.log("Columns related to cabang/proyek in TOKO:", res.rows);
    } catch (e: any) { console.error(e.message); }

    try {
        const res = await client.query(`SELECT DISTINCT cabang FROM toko LIMIT 100;`);
        console.log("Unique Cabang in TOKO:", res.rows.map(r => r.cabang));
    } catch(e: any) { console.error("Error Cabang in Toko:", e.message); }

    try {
        const res = await client.query(`SELECT DISTINCT proyek FROM toko LIMIT 100;`);
        console.log("Unique Proyek in TOKO:", res.rows.map(r => r.proyek));
    } catch(e: any) { console.error("Error Proyek in Toko:", e.message); }
    
    await client.end();
}

main().catch(console.error);
