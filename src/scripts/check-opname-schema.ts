import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkOpnameSchema() {
  try {
    // Check opname_final table structure
    const schema = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'opname_final'
      ORDER BY ordinal_position
    `);

    console.log("OPNAME_FINAL TABLE SCHEMA:");
    console.log("=".repeat(60));
    for (const col of schema.rows) {
      console.log(`${col.column_name.padEnd(35)} | ${col.data_type.padEnd(15)} | ${col.is_nullable}`);
    }
    console.log();

    // Check sample data
    const sample = await pool.query(`
      SELECT *
      FROM opname_final
      LIMIT 3
    `);

    console.log("SAMPLE DATA (3 records):");
    console.log("=".repeat(60));
    console.log(JSON.stringify(sample.rows, null, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkOpnameSchema();
