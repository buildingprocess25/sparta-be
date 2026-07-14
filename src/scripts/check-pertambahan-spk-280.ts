import { pool } from "../db/pool";

/**
 * Script untuk cek detail pertambahan SPK ID 280
 */

async function checkPertambahanSpk280() {
  console.log("=".repeat(80));
  console.log("CHECK: Pertambahan SPK ID 280");
  console.log("=".repeat(80));
  console.log();

  // 1. Cek data pertambahan SPK ID 280
  console.log("📋 Data Pertambahan SPK ID 280");
  console.log("-".repeat(80));
  const pertambahanRes = await pool.query(`
    SELECT 
      pt.*
    FROM pertambahan_spk pt
    WHERE pt.id = 280
  `);

  if (pertambahanRes.rows.length === 0) {
    console.log("❌ Pertambahan SPK ID 280 TIDAK DITEMUKAN!");
    return;
  }

  const pertambahan = pertambahanRes.rows[0];
  console.log(JSON.stringify(pertambahan, null, 2));
  console.log();

  // 2. Cek SPK terkait
  console.log("📋 Data SPK Terkait (id_spk: " + pertambahan.id_spk + ")");
  console.log("-".repeat(80));
  const spkRes = await pool.query(`
    SELECT 
      ps.id,
      ps.id_toko,
      ps.nomor_spk,
      ps.nama_kontraktor,
      ps.waktu_mulai,
      ps.waktu_selesai,
      ps.durasi,
      ps.created_at
    FROM pengajuan_spk ps
    WHERE ps.id = $1
  `, [pertambahan.id_spk]);

  if (spkRes.rows.length === 0) {
    console.log("❌ SPK tidak ditemukan!");
    return;
  }

  const spk = spkRes.rows[0];
  console.log(JSON.stringify(spk, null, 2));
  console.log();

  // 3. Cek toko terkait
  console.log("📍 Data Toko Terkait (id_toko: " + spk.id_toko + ")");
  console.log("-".repeat(80));
  const tokoRes = await pool.query(`
    SELECT 
      t.id,
      t.nomor_ulok,
      t.nama_toko,
      t.kode_toko,
      t.cabang,
      t.lingkup_pekerjaan,
      t.proyek
    FROM toko t
    WHERE t.id = $1
  `, [spk.id_toko]);

  if (tokoRes.rows.length > 0) {
    console.log(JSON.stringify(tokoRes.rows[0], null, 2));
  } else {
    console.log("❌ Toko tidak ditemukan!");
  }
  console.log();

  // 4. Cek semua pertambahan untuk SPK ini
  console.log("📅 Semua Pertambahan SPK untuk SPK ID: " + spk.id);
  console.log("-".repeat(80));
  const allPertambahanRes = await pool.query(`
    SELECT 
      pt.id,
      pt.pertambahan_hari,
      pt.tanggal_spk_akhir,
      pt.tanggal_spk_akhir_setelah_perpanjangan,
      pt.status_persetujuan,
      pt.disetujui_oleh,
      pt.waktu_persetujuan,
      pt.created_at
    FROM pertambahan_spk pt
    WHERE pt.id_spk = $1
    ORDER BY pt.created_at DESC
  `, [spk.id]);

  console.log(`Total: ${allPertambahanRes.rows.length}`);
  allPertambahanRes.rows.forEach((p, idx) => {
    console.log(`\n[${idx + 1}] ID: ${p.id} | Status: ${p.status_persetujuan}`);
    console.log(JSON.stringify(p, null, 2));
  });
  console.log();

  // 5. Cek effective waktu selesai
  console.log("🔍 Effective Waktu Selesai");
  console.log("-".repeat(80));
  const effectiveRes = await pool.query(`
    SELECT
      ps.id as id_spk,
      ps.nomor_spk,
      ps.waktu_selesai as waktu_selesai_original,
      COALESCE(extension.approved_until, ps.waktu_selesai::date) AS effective_waktu_selesai,
      extension.approved_until as extension_date
    FROM pengajuan_spk ps
    LEFT JOIN LATERAL (
      SELECT MAX(parsed_extension_date) AS approved_until
      FROM (
        SELECT
          pt.id,
          pt.tanggal_spk_akhir_setelah_perpanjangan,
          pt.status_persetujuan,
          CASE
            WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
              THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
            WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
              THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
            ELSE NULL::date
          END AS parsed_extension_date
        FROM pertambahan_spk pt
        WHERE pt.id_spk = ps.id
          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
      ) parsed
    ) extension ON TRUE
    WHERE ps.id = $1
  `, [spk.id]);

  console.log(JSON.stringify(effectiveRes.rows[0], null, 2));
  console.log();

  // 6. Summary
  console.log("=".repeat(80));
  console.log("📋 SUMMARY");
  console.log("=".repeat(80));
  if (tokoRes.rows.length > 0) {
    console.log(`ULOK: ${tokoRes.rows[0].nomor_ulok}`);
    console.log(`Toko: ${tokoRes.rows[0].nama_toko}`);
    console.log(`Cabang: ${tokoRes.rows[0].cabang}`);
  }
  console.log(`SPK ID: ${spk.id}`);
  console.log(`Nomor SPK: ${spk.nomor_spk}`);
  console.log(`SPK Original End: ${spk.waktu_selesai}`);
  console.log(`Pertambahan SPK ID: ${pertambahan.id}`);
  console.log(`Status: ${pertambahan.status_persetujuan}`);
  console.log(`Tanggal Perpanjangan: ${pertambahan.tanggal_spk_akhir_setelah_perpanjangan}`);
  if (effectiveRes.rows[0]) {
    console.log(`Effective End (System): ${effectiveRes.rows[0].effective_waktu_selesai}`);
  }
  console.log("=".repeat(80));
}

checkPertambahanSpk280()
  .then(() => {
    console.log("\n✅ Check selesai");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
