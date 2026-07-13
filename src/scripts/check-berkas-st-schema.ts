import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'berkas_serah_terima' 
    ORDER BY ordinal_position
  `);
  
  console.log("berkas_serah_terima columns:");
  result.rows.forEach(row => console.log(`  - ${row.column_name}`));
  
  await pool.end();
}

checkSchema();
