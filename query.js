const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/sparta' });
client.connect().then(() => {
    return client.query("SELECT t.id, t.nama_toko, o.id as opname_id, o.nilai_denda, o.hari_denda, b.created_at as st_date FROM toko t LEFT JOIN opname_final o ON t.id = o.id_toko LEFT JOIN berkas_serah_terima b ON t.id = b.id_toko WHERE t.nama_toko ILIKE '%wenang manado%'");
}).then(res => {
    console.log(res.rows);
    client.end();
}).catch(err => {
    console.error(err);
    client.end();
});
