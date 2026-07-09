import { pool } from "./src/db/pool";

async function run() {
    const res = await pool.query(`
        SELECT p.waktu_mulai, p.durasi, t.lingkup_pekerjaan
        FROM pengajuan_spk p
        JOIN toko t ON p.id_toko = t.id
        WHERE t.nomor_ulok = 'HZ01-2605-H579-R'
    `);
    console.log("SPK:", res.rows);
    process.exit(0);
}

run().catch(console.error);
