import { Client } from 'pg';

const connectionString = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable';

async function searchInDatabase(searchValue: string) {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    
    // Get all tables and their columns (text or varchar)
    const columnsQuery = `
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND data_type IN ('character varying', 'text');
    `;
    
    const { rows: columns } = await client.query(columnsQuery);
    
    const tables: Record<string, string[]> = {};
    for (const row of columns) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(row.column_name);
    }

    console.log(`Searching for '${searchValue}' in database...`);
    let found = false;

    for (const [table, cols] of Object.entries(tables)) {
      if (cols.length === 0) continue;
      
      const whereClause = cols.map(col => `"${col}" LIKE $1`).join(' OR ');
      const query = `SELECT * FROM "${table}" WHERE ${whereClause} LIMIT 5`;
      
      try {
        const { rows } = await client.query(query, [`%${searchValue}%`]);
        if (rows.length > 0) {
          found = true;
          console.log(`\n=== Found in table: ${table} ===`);
          console.log(`Matched records: ${rows.length} (showing up to 5)`);
          console.log(JSON.stringify(rows, null, 2));
        }
      } catch (err: any) {
        // Skip errors like "column does not exist" or permission denied for specific tables if any
        // console.error(`Error querying ${table}: ${err.message}`);
      }
    }
    
    if (!found) {
      console.log(`\nNo records found containing '${searchValue}'.`);
    }

  } catch (error) {
    console.error('Database connection or search error:', error);
  } finally {
    await client.end();
  }
}

searchInDatabase('LZ01-2605-L646-R');
