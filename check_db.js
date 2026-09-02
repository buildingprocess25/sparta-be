const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@sparta-database-ab2i0p:5432/building?sslmode=disable'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%kontraktor%' OR table_name LIKE '%mitra%' OR table_name LIKE '%pengawasan%' OR table_name LIKE '%peringatan%' OR table_name LIKE '%opname%' OR table_name LIKE '%spk%' OR table_name LIKE '%denda%' OR table_name LIKE '%rab%' OR table_name LIKE '%toko%')
    ORDER BY table_name, ordinal_position;
  `);
  
  const tables = {};
  res.rows.forEach(r => {
    if(!tables[r.table_name]) tables[r.table_name] = [];
    tables[r.table_name].push(r.column_name + ' (' + r.data_type + ')');
  });
  
  console.log(JSON.stringify(tables, null, 2));
  await client.end();
}
run().catch(console.error);
