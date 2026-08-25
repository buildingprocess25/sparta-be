import { pool } from "./src/db/pool";

async function main() {
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('rab', 'rab_detail', 'pengajuan_spk', 'opname_final')
      ORDER BY table_name, ordinal_position;
    `);
    
    const schema: Record<string, string[]> = {};
    res.rows.forEach((row: any) => {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push(row.column_name + ' (' + row.data_type + ')');
    });
    
    console.log(JSON.stringify(schema, null, 2));

    const tables = ["rab_item", "opname_final_item"];
    const schemas: Record<string, string[]> = {};
    for (const table of tables) {
      const colQuery = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      schemas[table] = colQuery.rows.map((row) => \`\${row.column_name} (\${row.data_type})\`);
    }
    console.log(JSON.stringify(schemas, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
