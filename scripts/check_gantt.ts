import { Client } from 'pg';

const connectionString = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable';

async function checkGantt() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // check tables that might be the gantt parent
    const tables = ['gantt', 'gantt_chart', 'jadwal_gantt'];
    for (const table of tables) {
      try {
        const { rows } = await client.query(`SELECT * FROM ${table} WHERE id = 104`);
        if (rows.length > 0) {
          console.log(`Found gantt parent in table: ${table}`);
        }
      } catch (e) {}
    }
  } finally {
    await client.end();
  }
}

checkGantt().catch(console.error);
