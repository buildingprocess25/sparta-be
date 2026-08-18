import { Client } from "pg";

const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
  try {
    await client.connect();
    
    // Check tables
    const q1 = `
      SELECT *
      FROM pengajuan_spk
      LIMIT 1;
    `;
    const res = await client.query(q1);
    console.log("pengajuan_spk columns:", Object.keys(res.rows[0]));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
