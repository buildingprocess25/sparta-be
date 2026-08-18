import { Client } from "pg";

const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });

async function main() {
  try {
    await client.connect();
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name ILIKE '%spk%';
        `);
        console.table(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
