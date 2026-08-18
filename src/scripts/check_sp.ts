import { Client } from "pg";

const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
  try {
    await client.connect();
    console.log("Connected to database");
    
    // Check if denda_action table exists
    const res1 = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('denda_action', 'surat_peringatan');");
    console.log("Found tables:", res1.rows);
    
    if (res1.rows.some(r => r.table_name === 'denda_action')) {
        const res2 = await client.query("SELECT * FROM denda_action WHERE action_type = 'SP' ORDER BY created_at DESC LIMIT 1;");
        console.log("Sample denda_action SP:");
        console.dir(res2.rows, { depth: null });
    }
    
    if (res1.rows.some(r => r.table_name === 'surat_peringatan')) {
        const res3 = await client.query("SELECT * FROM surat_peringatan ORDER BY created_at DESC LIMIT 1;");
        console.log("Sample surat_peringatan:");
        console.dir(res3.rows, { depth: null });
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
