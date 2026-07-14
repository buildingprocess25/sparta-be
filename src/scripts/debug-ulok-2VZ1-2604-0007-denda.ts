import { pool } from "../db/pool";

/**
 * Script untuk debug kenapa ULOK 2VZ1-2604-0007 masih kena denda
 * meskipun pertambahan SPK ID 280 sudah APPROVED
 */

async function debugDendaIssue() {
  const nomorUlok = "2VZ1-2604-0007";

  console.log("=".repeat(80));
  console.log("DEBUG: Denda Issue - ULOK 2VZ1-2604-0007");
  console.log("=".repeat(80));
  console.log();

  // 1. Cek data toko
  console.log("📍 STEP 1: Data Toko");
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
    WHERE t.nomor_ulok = $1
  `, [nomorUlok]);

  if (tokoRes.rows.length === 0) {
    console.log("❌ Toko tidak ditemukan!");
    return;
  }

  const toko = tokoRes.rows[0];
  console.log(JSON.stringify(toko, null, 2));
  console.log();

  // 2. Cek data SPK
  console.log("📋 STEP 2: Data SPK");
  console.log("-".repeat(80));
  const spkRes = await pool.query(`
    SELECT 
      ps.id,
      ps.nomor_spk,
      ps.nama_kontraktor,
      ps.waktu_mulai,
      ps.waktu_selesai,
      ps.durasi,
      ps.created_at
    FROM pengajuan_spk ps
    WHERE ps.id_toko = $1
    ORDER BY ps.created_at DESC
    LIMIT 1
  `, [toko.id]);

  if (spkRes.rows.length === 0) {
    console.log("❌ SPK tidak ditemukan!");
    return;
  }

  const spk = spkRes.rows[0];
  console.log(JSON.stringify(spk, null, 2));
  console.log();

  // 3. Cek pertambahan SPK
  console.log("📅 STEP 3: Pertambahan SPK");
  console.log("-".repeat(80));
  const pertambahanRes = await pool.query(`
    SELECT 
      pt.id,
      pt.id_spk,
      pt.pertambahan_hari,
      pt.tanggal_spk_akhir,
      pt.tanggal_spk_akhir_setelah_perpanjangan,
      pt.status_persetujuan,
      pt.alasan_perpanjangan,
      pt.disetujui_oleh,
      pt.waktu_persetujuan,
      pt.created_at
    FROM pertambahan_spk pt
    WHERE pt.id_spk = $1
    ORDER BY pt.created_at DESC
  `, [spk.id]);

  console.log(`Total pertambahan SPK: ${pertambahanRes.rows.length}`);
  pertambahanRes.rows.forEach((p, idx) => {
    console.log(`\n[${idx + 1}] ID: ${p.id} | Status: ${p.status_persetujuan}`);
    console.log(JSON.stringify(p, null, 2));
  });
  console.log();

  // 4. Cek effective_waktu_selesai (query yang digunakan sistem)
  console.log("🔍 STEP 4: Effective Waktu Selesai (Query Sistem)");
  console.log("-".repeat(80));
  const effectiveRes = await pool.query(`
    SELECT
      ps.id as id_spk,
      ps.nomor_spk,
      ps.waktu_selesai as waktu_selesai_original,
      COALESCE(extension.approved_until, ps.waktu_selesai::date) AS effective_waktu_selesai
    FROM pengajuan_spk ps
    JOIN toko t ON t.id = ps.id_toko
    LEFT JOIN LATERAL (
      SELECT MAX(parsed_extension_date) AS approved_until
      FROM (
        SELECT
          CASE
            WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
              THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
            WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
              THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
            ELSE NULL::date
          END AS parsed_extension_date
        FROM pertambahan_spk pt
        JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
        JOIN toko t_source ON t_source.id = ps_source.id_toko
        WHERE t_source.nomor_ulok = t.nomor_ulok
          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
      ) parsed
    ) extension ON TRUE
    WHERE ps.id = $1
  `, [spk.id]);

  console.log("Hasil query effective_waktu_selesai:");
  console.log(JSON.stringify(effectiveRes.rows[0], null, 2));
  console.log();

  // 5. Cek parsing tanggal perpanjangan
  console.log("🔬 STEP 5: Test Parsing Tanggal Perpanjangan");
  console.log("-".repeat(80));
  for (const p of pertambahanRes.rows) {
    const parseRes = await pool.query(`
      SELECT
        $1 as original_value,
        CASE
          WHEN TRIM(COALESCE($1, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN LEFT(TRIM($1), 10)::date
          WHEN TRIM(COALESCE($1, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
            THEN to_date(TRIM($1), 'DD/MM/YYYY')
          ELSE NULL::date
        END AS parsed_date,
        UPPER(TRIM(COALESCE($2, ''))) as status_upper,
        UPPER(TRIM(COALESCE($2, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED') as is_approved
    `, [p.tanggal_spk_akhir_setelah_perpanjangan, p.status_persetujuan]);

    console.log(`\nPertambahan SPK ID: ${p.id}`);
    console.log(JSON.stringify(parseRes.rows[0], null, 2));
  }
  console.log();

  // 6. Cek perhitungan delay (denda)
  console.log("💰 STEP 6: Perhitungan Delay/Denda");
  console.log("-".repeat(80));
  const delayRes = await pool.query(`
    WITH base AS (
      SELECT
        ps.id,
        t.nomor_ulok,
        COALESCE(extension.approved_until, ps.waktu_selesai::date) AS end_date,
        (timezone('Asia/Jakarta', now()))::date AS today
      FROM pengajuan_spk ps
      JOIN toko t ON t.id = ps.id_toko
      LEFT JOIN LATERAL (
        SELECT MAX(parsed_extension_date) AS approved_until
        FROM (
          SELECT
            CASE
              WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
                THEN LEFT(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 10)::date
              WHEN TRIM(COALESCE(pt.tanggal_spk_akhir_setelah_perpanjangan, '')) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
                THEN to_date(TRIM(pt.tanggal_spk_akhir_setelah_perpanjangan), 'DD/MM/YYYY')
              ELSE NULL::date
            END AS parsed_extension_date
          FROM pertambahan_spk pt
          JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
          JOIN toko t_source ON t_source.id = ps_source.id_toko
          WHERE t_source.nomor_ulok = t.nomor_ulok
            AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
        ) parsed
      ) extension ON TRUE
      WHERE ps.id = $1
    ),
    free_day AS (
      SELECT
        CASE
          WHEN end_date IS NULL THEN NULL::date
          WHEN EXTRACT(ISODOW FROM end_date + 1) = 6 THEN end_date + 3
          WHEN EXTRACT(ISODOW FROM end_date + 1) = 7 THEN end_date + 2
          ELSE end_date + 1
        END AS free_date,
        end_date,
        today
      FROM base
    ),
    counted AS (
      SELECT 
        free_date,
        end_date,
        today,
        COUNT(*)::int AS hari
      FROM free_day,
      LATERAL generate_series(free_date + 1, today, INTERVAL '1 day') AS day(value)
      WHERE free_date IS NOT NULL
        AND today > free_date
        AND EXTRACT(ISODOW FROM day.value) BETWEEN 1 AND 5
      GROUP BY free_date, end_date, today
    )
    SELECT
      end_date,
      today,
      free_date,
      COALESCE(hari, 0)::int AS hari_terlambat,
      LEAST(
        (LEAST(COALESCE(hari, 0), 5) * 1000000)
        + (GREATEST(0, LEAST(COALESCE(hari, 0) - 5, 5)) * 500000),
        7500000
      )::numeric AS nilai_terlambat
    FROM counted
  `, [spk.id]);

  if (delayRes.rows.length > 0) {
    console.log("Hasil perhitungan delay:");
    console.log(JSON.stringify(delayRes.rows[0], null, 2));
  } else {
    console.log("✅ Tidak ada delay (belum terlambat atau tidak ada data)");
  }
  console.log();

  // 7. Cek opname_final
  console.log("📊 STEP 7: Data Opname Final");
  console.log("-".repeat(80));
  const opnameRes = await pool.query(`
    SELECT 
      ofn.id,
      ofn.id_toko,
      ofn.status_opname_final,
      ofn.hari_denda,
      ofn.nilai_denda,
      ofn.tanggal_akhir_spk_denda,
      ofn.tanggal_serah_terima_denda,
      ofn.created_at
    FROM opname_final ofn
    WHERE ofn.id_toko = $1
    ORDER BY ofn.created_at DESC
  `, [toko.id]);

  console.log(`Total opname_final: ${opnameRes.rows.length}`);
  opnameRes.rows.forEach((o, idx) => {
    console.log(`\n[${idx + 1}] ID: ${o.id} | Status: ${o.status_opname_final}`);
    console.log(JSON.stringify(o, null, 2));
  });
  console.log();

  // 8. Cek denda_keterlambatan_action
  console.log("⚠️ STEP 8: Denda Keterlambatan Action");
  console.log("-".repeat(80));
  const dendaActionRes = await pool.query(`
    SELECT 
      dka.id,
      dka.id_toko,
      dka.id_opname_final,
      dka.nomor_ulok,
      dka.action_type,
      dka.status,
      dka.hari_denda,
      dka.nilai_denda,
      dka.sp_level,
      dka.created_at
    FROM denda_keterlambatan_action dka
    WHERE dka.id_toko = $1
    ORDER BY dka.created_at DESC
  `, [toko.id]);

  console.log(`Total denda_keterlambatan_action: ${dendaActionRes.rows.length}`);
  dendaActionRes.rows.forEach((d, idx) => {
    console.log(`\n[${idx + 1}] ID: ${d.id} | Type: ${d.action_type} | Status: ${d.status}`);
    console.log(JSON.stringify(d, null, 2));
  });
  console.log();

  // 9. Summary
  console.log("=".repeat(80));
  console.log("📋 SUMMARY");
  console.log("=".repeat(80));
  console.log(`ULOK: ${nomorUlok}`);
  console.log(`SPK ID: ${spk.id}`);
  console.log(`SPK Original End: ${spk.waktu_selesai}`);
  
  const approved = pertambahanRes.rows.filter(p => 
    ['APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED'].includes(
      String(p.status_persetujuan).trim().toUpperCase()
    )
  );
  console.log(`Approved Extensions: ${approved.length}`);
  if (approved.length > 0) {
    console.log(`Latest Approved Extension Date: ${approved[0].tanggal_spk_akhir_setelah_perpanjangan}`);
  }
  
  if (effectiveRes.rows[0]) {
    console.log(`Effective End Date (Used by System): ${effectiveRes.rows[0].effective_waktu_selesai}`);
  }
  
  if (delayRes.rows[0]) {
    console.log(`Hari Terlambat: ${delayRes.rows[0].hari_terlambat}`);
    console.log(`Nilai Denda: Rp ${Number(delayRes.rows[0].nilai_terlambat).toLocaleString('id-ID')}`);
  }
  
  console.log("=".repeat(80));
}

debugDendaIssue()
  .then(() => {
    console.log("\n✅ Debug selesai");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
