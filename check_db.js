const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
async function run() {
    await client.connect();
    let res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'opname_final'");
    console.log('opname_final:\n', res.rows.map(r => r.column_name).join(', '));
    res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ktk'");
    console.log('ktk:\n', res.rows.map(r => r.column_name).join(', '));
    res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'toko'");
    console.log('toko:\n', res.rows.map(r => r.column_name).join(', '));
    res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pengajuan_spk'");
    console.log('pengajuan_spk:\n', res.rows.map(r => r.column_name).join(', '));
    await client.end();
}
run().catch(console.error);
