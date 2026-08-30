import { pool } from "./src/db/pool";

async function run() {
    try {
        console.log("=== TOKO ===");
        const toko = await pool.query(`SELECT id, nomor_ulok, nama_toko, kode_toko FROM toko WHERE nomor_ulok LIKE '%2AZ1-2605-0009%'`);
        console.table(toko.rows);

        const tokoIds = toko.rows.map(t => t.id);

        if (tokoIds.length > 0) {
            console.log("\n=== RAB ===");
            const rab = await pool.query(`SELECT id, id_toko, status, jenis_pekerjaan, total_nilai, no_sph, no_dokumen FROM rab WHERE id_toko = ANY($1)`, [tokoIds]);
            console.table(rab.rows);
            
            console.log("\n=== SPK ===");
            const spk = await pool.query(`SELECT id, id_toko, status, jenis_pekerjaan, nilai_spk, no_spk, nomor_spk_manual FROM pengajuan_spk WHERE id_toko = ANY($1)`, [tokoIds]);
            console.table(spk.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
