import { pool } from "../db/pool";

/**
 * Script untuk verifikasi bahwa pertambahan SPK SEHARUSNYA berlaku
 * untuk SEMUA lingkup dalam 1 ULOK yang sama
 */

async function verifyPertambahanCrossLingkup() {
  const nomorUlok = "2VZ1-2604-0007";

  console.log("=".repeat(80));
  console.log("VERIFY: Pertambahan SPK Should Apply to All Lingkup");
  console.log("=".repeat(80));
  console.log();

  // 1. Cek semua toko dengan ULOK yang sama
  console.log("📍 STEP 1: Semua Toko dengan ULOK " + nomorUlok);
  console.log("-".repeat(80));
  const tokoRes = await pool.query(`
    SELECT 
      t.id,
      t.nomor_ulok,
      t.nama_toko,
      t.lingkup_pekerjaan,
      t.cabang
    FROM toko t
    WHERE t.nomor_ulok = $1
    ORDER BY t.lingkup_pekerjaan
  `, [nomorUlok]);

  console.log(`Total toko: ${tokoRes.rows.length}`);
  tokoRes.rows.forEach((t, idx) => {
    console.log(`[${idx + 1}] ID: ${t.id} | Lingkup: ${t.lingkup_pekerjaan} | ${t.nama_toko}`);
  });
  console.log();

  // 2. Cek SPK untuk masing-masing toko
  console.log("📋 STEP 2: SPK untuk Masing-masing Lingkup");
  console.log("-".repeat(80));
  
  const spkData = [];
  for (const toko of tokoRes.rows) {
    const spkRes = await pool.query(`
      SELECT 
        ps.id,
        ps.id_toko,
        ps.nomor_spk,
        ps.waktu_selesai
      FROM pengajuan_spk ps
      WHERE ps.id_toko = $1
      ORDER BY ps.created_at DESC
      LIMIT 1
    `, [toko.id]);

    if (spkRes.rows.length > 0) {
      const spk = spkRes.rows[0];
      spkData.push({
        toko_id: toko.id,
        lingkup: toko.lingkup_pekerjaan,
        spk_id: spk.id,
        nomor_spk: spk.nomor_spk,
        waktu_selesai: spk.waktu_selesai
      });
      console.log(`${toko.lingkup_pekerjaan}: SPK ID ${spk.id} | ${spk.nomor_spk} | End: ${spk.waktu_selesai}`);
    } else {
      console.log(`${toko.lingkup_pekerjaan}: TIDAK ADA SPK`);
    }
  }
  console.log();

  // 3. Cek pertambahan SPK untuk masing-masing SPK (QUERY SAAT INI - SALAH)
  console.log("❌ STEP 3: Query SAAT INI (Per SPK) - SALAH");
  console.log("-".repeat(80));
  
  for (const data of spkData) {
    const pertambahanRes = await pool.query(`
      SELECT 
        pt.id,
        pt.id_spk,
        pt.tanggal_spk_akhir_setelah_perpanjangan,
        pt.status_persetujuan
      FROM pertambahan_spk pt
      WHERE pt.id_spk = $1
        AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
      ORDER BY pt.created_at DESC
    `, [data.spk_id]);

    console.log(`${data.lingkup} (SPK ${data.spk_id}):`);
    if (pertambahanRes.rows.length > 0) {
      console.log(`  ✅ Ditemukan ${pertambahanRes.rows.length} pertambahan`);
      pertambahanRes.rows.forEach(p => {
        console.log(`     - ID ${p.id}: ${p.tanggal_spk_akhir_setelah_perpanjangan} (${p.status_persetujuan})`);
      });
    } else {
      console.log(`  ❌ TIDAK ADA pertambahan (akan kena denda!)`);
    }
  }
  console.log();

  // 4. Query SEHARUSNYA (Cross-Lingkup by ULOK) - BENAR
  console.log("✅ STEP 4: Query SEHARUSNYA (Cross-Lingkup by ULOK) - BENAR");
  console.log("-".repeat(80));
  
  for (const data of spkData) {
    const pertambahanRes = await pool.query(`
      SELECT 
        pt.id,
        pt.id_spk,
        pt.tanggal_spk_akhir_setelah_perpanjangan,
        pt.status_persetujuan,
        ps_related.nomor_spk as related_spk,
        t_related.lingkup_pekerjaan as related_lingkup
      FROM pertambahan_spk pt
      JOIN pengajuan_spk ps ON ps.id = pt.id_spk
      JOIN toko t ON t.id = ps.id_toko
      JOIN toko t_target ON t_target.nomor_ulok = t.nomor_ulok
      JOIN pengajuan_spk ps_related ON ps_related.id_toko = t_target.id
      JOIN toko t_related ON t_related.id = ps_related.id_toko
      WHERE t_target.id = $1
        AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
      ORDER BY pt.created_at DESC
    `, [data.toko_id]);

    console.log(`${data.lingkup} (Toko ${data.toko_id}):`);
    if (pertambahanRes.rows.length > 0) {
      console.log(`  ✅ Ditemukan ${pertambahanRes.rows.length} pertambahan (dari semua lingkup)`);
      pertambahanRes.rows.forEach(p => {
        console.log(`     - ID ${p.id} dari ${p.related_lingkup}: ${p.tanggal_spk_akhir_setelah_perpanjangan}`);
      });
    } else {
      console.log(`  ❌ TIDAK ADA pertambahan`);
    }
  }
  console.log();

  // 5. Test Query Fix untuk effective_waktu_selesai
  console.log("🔧 STEP 5: Test Query Fix - Effective Waktu Selesai (Cross-Lingkup)");
  console.log("-".repeat(80));
  
  for (const data of spkData) {
    const effectiveRes = await pool.query(`
      SELECT
        ps.id as id_spk,
        ps.nomor_spk,
        t.lingkup_pekerjaan,
        ps.waktu_selesai as waktu_selesai_original,
        COALESCE(extension.approved_until, ps.waktu_selesai::date) AS effective_waktu_selesai,
        extension.source_lingkup,
        extension.pertambahan_id
      FROM pengajuan_spk ps
      JOIN toko t ON t.id = ps.id_toko
      LEFT JOIN LATERAL (
        SELECT 
          MAX(parsed_extension_date) AS approved_until,
          MAX(t_source.lingkup_pekerjaan) as source_lingkup,
          MAX(pt.id) as pertambahan_id
        FROM (
          SELECT
            pt.id,
            pt.id_spk,
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
        JOIN pengajuan_spk ps_join ON ps_join.id = parsed.id_spk
        JOIN toko t_source ON t_source.id = ps_join.id_toko
      ) extension ON TRUE
      WHERE ps.id = $1
    `, [data.spk_id]);

    if (effectiveRes.rows.length > 0) {
      const result = effectiveRes.rows[0];
      console.log(`${data.lingkup}:`);
      console.log(`  Original End: ${result.waktu_selesai_original}`);
      console.log(`  Effective End: ${result.effective_waktu_selesai}`);
      if (result.source_lingkup) {
        console.log(`  Source: Pertambahan dari ${result.source_lingkup} (ID: ${result.pertambahan_id})`);
      } else {
        console.log(`  Source: No extension`);
      }
    }
  }
  console.log();

  // 6. Summary
  console.log("=".repeat(80));
  console.log("📋 SUMMARY & DIAGNOSIS");
  console.log("=".repeat(80));
  console.log();
  console.log("❌ MASALAH:");
  console.log("   Query saat ini hanya mencari pertambahan berdasarkan id_spk.");
  console.log("   Akibatnya, jika pertambahan SPK dibuat untuk SIPIL (SPK A),");
  console.log("   maka ME (SPK B) TIDAK mendapat perpanjangan yang sama.");
  console.log();
  console.log("✅ SOLUSI:");
  console.log("   Query harus mencari pertambahan berdasarkan nomor_ulok (cross-lingkup).");
  console.log("   Dengan begitu, pertambahan untuk lingkup manapun akan berlaku untuk semua.");
  console.log();
  console.log("📝 FILE YANG PERLU DIPERBAIKI:");
  console.log("   - sparta-be/src/modules/surat-peringatan/sp.repository.ts");
  console.log("     (Line ~262-284: LEFT JOIN LATERAL untuk extension)");
  console.log();
  console.log("🔧 PERUBAHAN QUERY:");
  console.log("   BEFORE: WHERE pt.id_spk = ps.id");
  console.log("   AFTER:  WHERE t_source.nomor_ulok = t.nomor_ulok");
  console.log("=".repeat(80));
}

verifyPertambahanCrossLingkup()
  .then(() => {
    console.log("\n✅ Verifikasi selesai");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
