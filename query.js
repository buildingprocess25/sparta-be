const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
client.connect().then(() => 
    client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('pengawasan', 'pengawasan_gantt', 'kategori_pekerjaan_gantt', 'day_gantt_chart', 'opname_item')")
).then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
}).catch(console.error).finally(() => client.end());
