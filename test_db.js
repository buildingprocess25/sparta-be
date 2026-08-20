const { Pool } = require('pg'); 
const pool = new Pool({ user: 'postgres', host: '103.127.99.241', database: 'sparta', password: 'password', port: 5432 }); 
pool.query('SET search_path TO pju, public').then(() => pool.query(`SELECT id, nomor_ulok, lingkup_pekerjaan, cabang, nama_kontraktor FROM toko WHERE nomor_ulok = 'LZ01-2607-0001'`)).then(res => { console.log(res.rows); process.exit(0); });
