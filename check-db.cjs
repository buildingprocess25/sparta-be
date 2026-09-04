const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/sparta?sslmode=disable',
  });

  try {
    await client.connect();
    
    // Check columns
    const cols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User'
    `);
    console.log('Columns in User:', cols.rows.map(r => r.column_name));

    // Try to get the user
    const res = await client.query('SELECT * FROM "User" WHERE email = $1', ['wildan.fadillah@nusaputra.ac.id']);
    
    if (res.rows.length > 0) {
      console.log('User found in DB:', res.rows[0]);
    } else {
      console.log('User NOT found in DB.');
    }
  } catch (err) {
    console.error('Error connecting to DB or executing query:', err);
  } finally {
    await client.end();
  }
}

checkDb();
