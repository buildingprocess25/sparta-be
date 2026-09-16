const fs = require('fs');
const env = fs.readFileSync('c:/alfamart/KERJA/sparta-be/sparta-be.env', 'utf8');
const { Client } = require('pg');
const url = env.split('\n').find(l => l.startsWith('DATABASE_URL')).split('=')[1].trim();
const client = new Client(url);
client.connect().then(() => {
  client.query("SELECT r.id, r.status, t.nomor_ulok, t.nama_toko, t.cabang, t.lingkup_pekerjaan FROM \"rab\" r JOIN \"toko\" t ON r.id_toko = t.id WHERE r.status='Disetujui' LIMIT 5;").then(res => {
    console.log(res.rows);
    client.end();
  }).catch(e => console.error(e));
});
