import 'dotenv/config';
import { pool } from '../db/pool';

const failedIds = [2013, 999, 1001, 1075, 1076, 1100, 1104, 1263, 1323, 1234, 1248, 1025, 1029, 1258, 1259, 2011];

pool.query(
    `SELECT DISTINCT t.nomor_ulok, t.nama_toko, b.created_at::date as tanggal_st
     FROM toko t
     JOIN berkas_serah_terima b ON b.id_toko = t.id
     WHERE t.id != ALL($1::int[])
     ORDER BY t.nomor_ulok`,
    [failedIds]
).then(r => {
    console.log(`Total ULOK berhasil di-generate ulang: ${r.rows.length}`);
    console.table(r.rows);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
