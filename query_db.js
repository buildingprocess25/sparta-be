const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'maintenance-sparta.i.aivencloud.com',
  port: process.env.DB_PORT || 19457,
  database: process.env.DB_NAME || 'sparta-building',
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log("Fixing typo in rab.nama_pt: CV EVLOGJA JAYA -> CV EVLOGIA JAYA");
    
    const res = await client.query(`
        UPDATE rab 
        SET nama_pt = 'CV EVLOGIA JAYA' 
        WHERE nama_pt = 'CV EVLOGJA JAYA'
        RETURNING id, nama_pt;
    `);
    
    console.log(`Updated ${res.rowCount} rows in rab table.`);
    if (res.rowCount > 0) {
      console.log("Updated rows:", JSON.stringify(res.rows, null, 2));
    }
    
    await client.query('COMMIT');
    console.log("Transaction committed successfully.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error occurred, rolling back:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
