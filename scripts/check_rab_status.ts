import { Client } from 'pg';

const connectionString = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable';

async function checkRab() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Check current RAB status
    const { rows } = await client.query(`SELECT status FROM rab WHERE id = 826`);
    console.log('Current RAB state:', rows[0]);
    
    // Let's also check other RABs to see example statuses for "waiting for gantt"
    const examples = await client.query(`
      SELECT status, COUNT(*) 
      FROM rab 
      GROUP BY status
    `);
    console.log('Available RAB statuses in DB:', examples.rows);

  } finally {
    await client.end();
  }
}

checkRab().catch(console.error);
