const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT p.*, r.kategori_pekerjaan as rab_kat, r.jenis_pekerjaan as rab_jen 
    FROM pengawasan p
    LEFT JOIN rab_item r ON p.jenis_pekerjaan = r.jenis_pekerjaan
    WHERE p.id_gantt IN (
      SELECT id FROM gantt_chart WHERE id_toko IN (2704, 2712)
    )
    LIMIT 10
  `);
  console.log("PENGAWASAN:", res.rows);
  
  const pgRes = await client.query(`
    SELECT * FROM pengawasan_gantt 
    WHERE id_gantt IN (
      SELECT id FROM gantt_chart WHERE id_toko IN (2704, 2712)
    )
    LIMIT 10
  `);
  console.log("PENGAWASAN GANTT:", pgRes.rows);
  
  await client.end();
}
run().catch(console.error);
