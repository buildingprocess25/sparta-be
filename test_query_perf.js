const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
client.connect().then(async () => {
    console.time('query');
    await client.query(`
        SELECT p.id, COALESCE(p.id_toko, t.id) AS id_toko, p.nomor_ulok
        FROM pengajuan_spk p
        LEFT JOIN toko t
          ON t.nomor_ulok = p.nomor_ulok
         AND LOWER(COALESCE(t.lingkup_pekerjaan, '')) = LOWER(COALESCE(p.lingkup_pekerjaan, ''))
    `);
    console.timeEnd('query');
    await client.end();
}).catch(err => console.error(err));
