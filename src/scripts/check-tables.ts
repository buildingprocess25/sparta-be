import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name LIKE '%spk%'
      ORDER BY table_name
    `);

    console.log("Tables with 'spk' in name:");
    for (const row of result.rows) {
      console.log(`  - ${row.table_name}`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkTables();
