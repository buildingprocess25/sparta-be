import { pool } from "../db/pool";

/**
 * Script untuk membuat pertambahan SPK untuk ME (SPK ID 327)
 * mengikuti perpanjangan yang sama dengan SIPIL
 */

async function createPertambahanSpkME() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log("=".repeat(80));
    console.log("CREATE: Pertambahan SPK untuk ME (SPK ID 327)");
    console.log("=".repeat(80));
    console.log();

    // Data pertambahan SPK (sama dengan SIPIL)
    const payload = {
      id_spk: 327,
      pertambahan_hari: "3",
      tanggal_spk_akhir: "2026-07-12",
      tanggal_spk_akhir_setelah_perpanjangan: "2026-07-15",
      alasan_perpanjangan: "Kondisi Cuaca (hujan) yang tidak memungkinkan untuk bekerja secara maksimal, data pendukung terlampir. (Sinkronisasi dengan perpanjangan SIPIL)",
      dibuat_oleh: "system@sat.co.id",
      status_persetujuan: "Disetujui BM",
      disetujui_oleh: "ikwan.n.raharjo@sat.co.id",
      waktu_persetujuan: new Date().toISOString(),
      link_pdf: null,
      link_lampiran_pendukung: "https://drive.google.com/file/d/1q_D7bmJvYgVMZUEm4Q-xehmq53jOIzGp/view?usp=drivesdk"
    };

    console.log("📋 Data yang akan diinsert:");
    console.log(JSON.stringify(payload, null, 2));
    console.log();

    console.log("⚠️  SCRIPT INI HANYA MENAMPILKAN PREVIEW!");
    console.log("    Untuk execute, uncomment bagian INSERT di script.");
    console.log();

    // Uncomment untuk execute
    /*
    const insertRes = await client.query(`
      INSERT INTO pertambahan_spk (
        id_spk,
        pertambahan_hari,
        tanggal_spk_akhir,
        tanggal_spk_akhir_setelah_perpanjangan,
        alasan_perpanjangan,
        dibuat_oleh,
        status_persetujuan,
        disetujui_oleh,
        waktu_persetujuan,
        link_pdf,
        link_lampiran_pendukung,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
      )
      RETURNING id
    `, [
      payload.id_spk,
      payload.pertambahan_hari,
      payload.tanggal_spk_akhir,
      payload.tanggal_spk_akhir_setelah_perpanjangan,
      payload.alasan_perpanjangan,
      payload.dibuat_oleh,
      payload.status_persetujuan,
      payload.disetujui_oleh,
      payload.waktu_persetujuan,
      payload.link_pdf,
      payload.link_lampiran_pendukung
    ]);

    console.log("✅ Pertambahan SPK berhasil dibuat!");
    console.log("   ID: " + insertRes.rows[0].id);
    console.log();

    // Refresh denda untuk toko ME
    console.log("🔄 Refreshing denda untuk toko ME...");
    // Ini akan otomatis dihandle oleh service saat approval
    */

    await client.query('ROLLBACK'); // Rollback karena preview
    console.log("✅ Preview selesai (ROLLBACK)");

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error:", error);
    throw error;
  } finally {
    client.release();
  }
}

createPertambahanSpkME()
  .then(() => {
    console.log("\n✅ Script selesai");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
