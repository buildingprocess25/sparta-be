import { Client } from 'pg';

const connectionString = 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable';

async function inspectDependencies() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Find all tables that have specific columns
    const columnsQuery = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public';
    `;
    
    const { rows: columns } = await client.query(columnsQuery);
    
    const tablesWithCols: Record<string, string[]> = {};
    for (const row of columns) {
      if (!tablesWithCols[row.table_name]) {
        tablesWithCols[row.table_name] = [];
      }
      tablesWithCols[row.table_name].push(row.column_name);
    }

    const queriesToRun: { table: string, condition: string }[] = [];

    for (const [table, cols] of Object.entries(tablesWithCols)) {
      const conditions: string[] = [];
      
      if (cols.includes('nomor_ulok')) {
        conditions.push(`"nomor_ulok" = 'LZ01-2605-L646-R'`);
      }
      if (cols.includes('id_spk')) {
        conditions.push(`"id_spk" = 38`);
      }
      if (cols.includes('id_rab')) {
        conditions.push(`"id_rab" = 826`);
      }
      if (cols.includes('gantt_id')) {
        conditions.push(`"gantt_id" = 104`);
      }
      if (cols.includes('id_gantt')) {
        conditions.push(`"id_gantt" = 104`);
      }

      if (conditions.length > 0) {
        queriesToRun.push({
          table,
          condition: conditions.join(' OR ')
        });
      }
    }

    for (const { table, condition } of queriesToRun) {
      const query = `SELECT * FROM "${table}" WHERE ${condition}`;
      try {
        const { rows } = await client.query(query);
        if (rows.length > 0) {
          console.log(`\n=== Found ${rows.length} records in table: ${table} ===`);
          console.log(`Condition: ${condition}`);
          // Print only the IDs or first row if it's long
          const preview = rows.map(r => {
            const sum = { id: r.id };
            if (r.nomor_ulok) sum['nomor_ulok'] = r.nomor_ulok;
            if (r.id_spk) sum['id_spk'] = r.id_spk;
            if (r.id_rab) sum['id_rab'] = r.id_rab;
            return sum;
          });
          console.log(JSON.stringify(preview, null, 2));
        }
      } catch (err: any) {
        // Skip errors
      }
    }
    
  } finally {
    await client.end();
  }
}

inspectDependencies().catch(console.error);
