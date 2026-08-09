const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable'
});

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT kpg.id, kpg.kategori_pekerjaan, dgc.h_awal, dgc.h_akhir
    FROM kategori_pekerjaan_gantt kpg
    LEFT JOIN day_gantt_chart dgc ON dgc.id_kategori_pekerjaan_gantt = kpg.id
    WHERE kpg.id_gantt IN (1436, 1438, 548, 550)
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
check();
