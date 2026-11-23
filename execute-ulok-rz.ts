import { pool, withTransaction } from './src/db/pool';

async function execute() {
  await withTransaction(async (client) => {
    console.log("Memulai transaksi penyelarasan durasi RZ01-2604-0012...");

    const idTokoME = 1912; // RZ01-2604-0012 ME

    // 1. Update RAB ME
    console.log("1. Update RAB ME menjadi durasi 45...");
    await client.query(`
      UPDATE rab
      SET durasi_pekerjaan = '45'
      WHERE id_toko = $1
    `, [idTokoME]);

    // 2. Update Pengajuan SPK ME
    console.log("2. Update Pengajuan SPK ME (durasi 45 dan waktu_selesai disamakan)...");
    await client.query(`
      UPDATE pengajuan_spk
      SET durasi = 45, waktu_selesai = '2026-08-09 07:00:00+07'
      WHERE id_toko = $1
    `, [idTokoME]);

    console.log("Proses selesai dan disimpan.");
  });
}

execute()
  .then(() => {
    console.log("DONE");
    process.exit(0);
  })
  .catch((e) => {
    console.error("GAGAL:", e);
    process.exit(1);
  });
