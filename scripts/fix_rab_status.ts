import { Client } from 'pg';

const connectionString = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable';

async function fixRab() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Update RAB status
    const res = await client.query(
      `UPDATE rab SET status = 'Menunggu Gantt Chart' WHERE id = 826 RETURNING id, status`
    );
    console.log('Updated RAB:', res.rows[0]);

  } finally {
    await client.end();
  }
}

fixRab().catch(console.error);
