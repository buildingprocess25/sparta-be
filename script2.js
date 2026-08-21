
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
async function run() {
  await client.connect();
  const opname_items = await client.query('SELECT * FROM opname_item WHERE id_toko = 1115 AND volume_akhir IN (1, 5.88) ORDER BY volume_akhir DESC');
  console.log('Opname Items with vol 1 or 5.88:', opname_items.rows);
  
  // also check if there are any Instruksi Lapangan opname items
  const opname_items_il = await client.query('SELECT * FROM opname_item WHERE id_toko = 1115 AND id_instruksi_lapangan_item IS NOT NULL');
  console.log('Opname Items IL:', opname_items_il.rows);
  
  await client.end();
}
run().catch(console.error);

