const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://aku-sparta:0hhUTvTHKtgkN8TfLadC@103.127.99.241:5432/building?sslmode=disable' });
pool.query("SELECT id, nomor_ulok, nama_toko FROM toko WHERE nomor_ulok = 'IZ01-2608-I996-R'", (err, res) => {
    console.log(err ? err : res.rows);
    pool.end();
});
