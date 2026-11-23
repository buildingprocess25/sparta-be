import { pool, withTransaction } from './src/db/pool';

async function execute() {
  await withTransaction(async (client) => {
    console.log("Memulai transaksi pembaruan ULOK...");

    const idTokoHapus = 1178; // IZ01-2603-I021-R SIPIL
    const idTokoUbahME = 1182; // IZ01-2603-I021-R ME -> IZ01-2604-I021-R ME
    const idTokoBaruSipil = 1305; // IZ01-2604-I021-R SIPIL

    // 1. Pindahkan ME ke nomor_ulok baru
    console.log("1. Memindahkan ME ke IZ01-2604-I021-R...");
    await client.query(`
      UPDATE toko
      SET nomor_ulok = 'IZ01-2604-I021-R'
      WHERE id = $1
    `, [idTokoUbahME]);

    // 2. Approve ME dan samakan durasi 35
    console.log("2. Menyetujui RAB ME & set durasi 35...");
    await client.query(`
      UPDATE rab
      SET status = 'Disetujui', durasi_pekerjaan = '35'
      WHERE id_toko = $1
    `, [idTokoUbahME]);

    // 3. Set durasi SIPIL (IZ01-2604-I021-R) menjadi 35
    console.log("3. Menyesuaikan durasi RAB SIPIL menjadi 35...");
    await client.query(`
      UPDATE rab
      SET durasi_pekerjaan = '35'
      WHERE id_toko = $1
    `, [idTokoBaruSipil]);

    // 4. Hapus data IZ01-2603-I021-R SIPIL (ID: 1178) beserta ketergantungannya
    console.log("4. Menghapus data IZ01-2603-I021-R SIPIL lama (id_toko = 1178)...");
    
    // Cari id_rab, id_gantt, dll
    const rabRes = await client.query(`SELECT id FROM rab WHERE id_toko = $1`, [idTokoHapus]);
    const ganttRes = await client.query(`SELECT id FROM gantt_chart WHERE id_toko = $1`, [idTokoHapus]);
    
    const rabIds = rabRes.rows.map(r => r.id);
    const ganttIds = ganttRes.rows.map(g => g.id);

    // Hapus ketergantungan RAB (rab_item, rab_revisi_item, dsb)
    if (rabIds.length > 0) {
      await client.query(`DELETE FROM rab_item WHERE id_rab = ANY($1)`, [rabIds]);
      await client.query(`DELETE FROM rab_revisi_item WHERE id_rab = ANY($1)`, [rabIds]);
      await client.query(`DELETE FROM rab WHERE id = ANY($1)`, [rabIds]);
    }

    // Hapus ketergantungan Gantt (day_gantt_chart, berkas_pengawasan, dll)
    if (ganttIds.length > 0) {
      await client.query(`DELETE FROM day_gantt_chart WHERE id_gantt = ANY($1)`, [ganttIds]);
      await client.query(`DELETE FROM gantt_chart_note WHERE id_gantt = ANY($1)`, [ganttIds]);
      await client.query(`DELETE FROM berkas_pengawasan WHERE id_pengawasan_gantt = ANY($1)`, [ganttIds]);
      await client.query(`DELETE FROM gantt_chart WHERE id = ANY($1)`, [ganttIds]);
    }

    // Hapus file terkait (berkas_serah_terima, opname jika ada)
    await client.query(`DELETE FROM berkas_serah_terima WHERE id_toko = $1`, [idTokoHapus]);
    
    // Hapus toko utama
    await client.query(`DELETE FROM toko WHERE id = $1`, [idTokoHapus]);

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
