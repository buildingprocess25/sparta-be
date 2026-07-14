import { pool } from "../db/pool";

/**
 * Script untuk audit data historis yang mungkin terpengaruh bug pertambahan SPK
 * 
 * Kategori data yang perlu dicek:
 * 1. Opname Final dengan denda yang mungkin salah (sudah locked/approved)
 * 2. Surat Peringatan yang sudah dikirim berdasarkan denda salah
 * 3. Denda Keterlambatan Action yang sudah dibuat
 */

async function auditHistoricalDendaImpact() {
  console.log("=".repeat(80));
  console.log("AUDIT: Historical Denda Impact dari Bug Pertambahan SPK");
  console.log("=".repeat(80));
  console.log();

  // 1. Cari ULOKs yang punya multiple lingkup + pertambahan SPK
  console.log("📋 STEP 1: Identifikasi ULOKs dengan Multiple Lingkup");
  console.log("-".repeat(80));
  
  const multiLingkupRes = await pool.query(`
    SELECT 
      t.nomor_ulok,
      COUNT(DISTINCT t.id) as total_toko,
      COUNT(DISTINCT t.lingkup_pekerjaan) as total_lingkup,
      STRING_AGG(DISTINCT t.lingkup_pekerjaan, ', ' ORDER BY t.lingkup_pekerjaan) as lingkup_list,
      MAX(t.cabang) as cabang
    FROM toko t
    WHERE t.nomor_ulok IS NOT NULL
    GROUP BY t.nomor_ulok
    HAVING COUNT(DISTINCT t.lingkup_pekerjaan) > 1
    ORDER BY t.nomor_ulok
  `);

  console.log(`Total ULOKs dengan multiple lingkup: ${multiLingkupRes.rows.length}`);
  console.log();

  // 2. Dari ULOKs tersebut, cari yang punya pertambahan SPK
  console.log("📅 STEP 2: ULOKs dengan Pertambahan SPK (Potentially Affected)");
  console.log("-".repeat(80));

  const affectedRes = await pool.query(`
    WITH multi_lingkup_ulok AS (
      SELECT 
        t.nomor_ulok,
        COUNT(DISTINCT t.id) as total_toko,
        COUNT(DISTINCT t.lingkup_pekerjaan) as total_lingkup
      FROM toko t
      WHERE t.nomor_ulok IS NOT NULL
      GROUP BY t.nomor_ulok
      HAVING COUNT(DISTINCT t.lingkup_pekerjaan) > 1
    )
    SELECT 
      ml.nomor_ulok,
      ml.total_toko,
      ml.total_lingkup,
      COUNT(DISTINCT pt.id) as total_pertambahan,
      COUNT(DISTINCT CASE WHEN UPPER(TRIM(pt.status_persetujuan)) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED') THEN pt.id END) as total_approved,
      STRING_AGG(DISTINCT t.lingkup_pekerjaan, ', ' ORDER BY t.lingkup_pekerjaan) as lingkup_list,
      MAX(t.cabang) as cabang
    FROM multi_lingkup_ulok ml
    JOIN toko t ON t.nomor_ulok = ml.nomor_ulok
    JOIN pengajuan_spk ps ON ps.id_toko = t.id
    JOIN pertambahan_spk pt ON pt.id_spk = ps.id
    GROUP BY ml.nomor_ulok, ml.total_toko, ml.total_lingkup
    HAVING COUNT(DISTINCT pt.id) > 0
    ORDER BY total_approved DESC, ml.nomor_ulok
  `);

  console.log(`ULOKs potentially affected: ${affectedRes.rows.length}`);
  console.log();
  
  if (affectedRes.rows.length > 0) {
    console.log("Top 10 ULOKs dengan approved pertambahan:");
    affectedRes.rows.slice(0, 10).forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.nomor_ulok} | Cabang: ${row.cabang}`);
      console.log(`    Lingkup: ${row.lingkup_list}`);
      console.log(`    Pertambahan: ${row.total_pertambahan} (${row.total_approved} approved)`);
    });
    console.log();
  }

  // 3. Cek Opname Final yang mungkin punya denda salah
  console.log("💰 STEP 3: Opname Final dengan Denda (Potentially Wrong)");
  console.log("-".repeat(80));

  const opnameDendaRes = await pool.query(`
    WITH multi_lingkup_ulok AS (
      SELECT 
        t.nomor_ulok
      FROM toko t
      WHERE t.nomor_ulok IS NOT NULL
      GROUP BY t.nomor_ulok
      HAVING COUNT(DISTINCT t.lingkup_pekerjaan) > 1
    ),
    ulok_with_pertambahan AS (
      SELECT DISTINCT
        ml.nomor_ulok
      FROM multi_lingkup_ulok ml
      JOIN toko t ON t.nomor_ulok = ml.nomor_ulok
      JOIN pengajuan_spk ps ON ps.id_toko = t.id
      JOIN pertambahan_spk pt ON pt.id_spk = ps.id
      WHERE UPPER(TRIM(pt.status_persetujuan)) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
    )
    SELECT 
      uwp.nomor_ulok,
      t.id as toko_id,
      t.lingkup_pekerjaan,
      t.cabang,
      ofn.id as opname_final_id,
      ofn.status_opname_final,
      ofn.hari_denda,
      ofn.nilai_denda,
      ofn.tanggal_akhir_spk_denda,
      ofn.created_at as opname_created_at
    FROM ulok_with_pertambahan uwp
    JOIN toko t ON t.nomor_ulok = uwp.nomor_ulok
    JOIN opname_final ofn ON ofn.id_toko = t.id
    WHERE COALESCE(ofn.hari_denda, 0) > 0
      AND ofn.status_opname_final IN ('APPROVED', 'WAITING_FOR_DIREKTUR', 'WAITING_FOR_MANAGER', 'WAITING_FOR_COORDINATOR')
    ORDER BY ofn.created_at DESC, uwp.nomor_ulok, t.lingkup_pekerjaan
    LIMIT 50
  `);

  console.log(`Opname Final dengan denda: ${opnameDendaRes.rows.length}`);
  console.log();

  if (opnameDendaRes.rows.length > 0) {
    console.log("Sample records:");
    opnameDendaRes.rows.slice(0, 10).forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.nomor_ulok} | ${row.lingkup_pekerjaan} | Opname ${row.opname_final_id}`);
      console.log(`    Status: ${row.status_opname_final}`);
      console.log(`    Denda: ${row.hari_denda} hari = Rp ${Number(row.nilai_denda).toLocaleString('id-ID')}`);
      console.log(`    Tanggal: ${row.opname_created_at}`);
    });
    console.log();
  }

  // 4. Cek Surat Peringatan yang sudah dibuat
  console.log("⚠️  STEP 4: Surat Peringatan (Potentially Wrong)");
  console.log("-".repeat(80));

  const spRes = await pool.query(`
    WITH multi_lingkup_ulok AS (
      SELECT 
        t.nomor_ulok
      FROM toko t
      WHERE t.nomor_ulok IS NOT NULL
      GROUP BY t.nomor_ulok
      HAVING COUNT(DISTINCT t.lingkup_pekerjaan) > 1
    ),
    ulok_with_pertambahan AS (
      SELECT DISTINCT
        ml.nomor_ulok
      FROM multi_lingkup_ulok ml
      JOIN toko t ON t.nomor_ulok = ml.nomor_ulok
      JOIN pengajuan_spk ps ON ps.id_toko = t.id
      JOIN pertambahan_spk pt ON pt.id_spk = ps.id
      WHERE UPPER(TRIM(pt.status_persetujuan)) IN ('APPROVED_BY_BM', 'DISETUJUI BM', 'DISETUJUI', 'APPROVED')
    )
    SELECT 
      uwp.nomor_ulok,
      t.id as toko_id,
      t.lingkup_pekerjaan,
      t.cabang,
      dka.id as action_id,
      dka.action_type,
      dka.status,
      dka.sp_level,
      dka.hari_denda,
      dka.nilai_denda,
      dka.created_at as action_created_at
    FROM ulok_with_pertambahan uwp
    JOIN toko t ON t.nomor_ulok = uwp.nomor_ulok
    JOIN denda_keterlambatan_action dka ON dka.id_toko = t.id
    WHERE dka.action_type = 'SP'
    ORDER BY dka.created_at DESC, uwp.nomor_ulok, t.lingkup_pekerjaan
    LIMIT 50
  `);

  console.log(`Surat Peringatan: ${spRes.rows.length}`);
  console.log();

  if (spRes.rows.length > 0) {
    console.log("Sample records:");
    spRes.rows.slice(0, 10).forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.nomor_ulok} | ${row.lingkup_pekerjaan} | Action ${row.action_id}`);
      console.log(`    Type: ${row.action_type} | Status: ${row.status} | Level: ${row.sp_level || 'N/A'}`);
      console.log(`    Denda: ${row.hari_denda} hari = Rp ${Number(row.nilai_denda).toLocaleString('id-ID')}`);
      console.log(`    Tanggal: ${row.action_created_at}`);
    });
    console.log();
  }

  // 5. Summary & Recommendation
  console.log("=".repeat(80));
  console.log("📋 SUMMARY & RECOMMENDATIONS");
  console.log("=".repeat(80));
  console.log();
  console.log(`Total ULOKs dengan multiple lingkup: ${multiLingkupRes.rows.length}`);
  console.log(`ULOKs potentially affected (punya pertambahan): ${affectedRes.rows.length}`);
  console.log(`Opname Final dengan denda (perlu review): ${opnameDendaRes.rows.length}`);
  console.log(`Surat Peringatan (perlu review): ${spRes.rows.length}`);
  console.log();
  console.log("🔍 NEXT ACTIONS:");
  console.log();
  console.log("1. ✅ QUERY FIX - SUDAH SELESAI");
  console.log("   Data kedepannya otomatis benar.");
  console.log();
  console.log("2. ⚠️  OPNAME FINAL - PERLU REVIEW");
  console.log("   - Opname yang sudah APPROVED mungkin punya denda salah");
  console.log("   - Pertimbangkan: apakah perlu di-recalculate?");
  console.log("   - Jika ya, perlu approval management untuk adjust nilai");
  console.log();
  console.log("3. ⚠️  SURAT PERINGATAN - PERLU REVIEW");
  console.log("   - SP yang sudah dikirim mungkin berdasarkan denda salah");
  console.log("   - Pertimbangkan: apakah perlu di-revoke atau clarify?");
  console.log("   - Decision: business/legal team");
  console.log();
  console.log("4. 📊 DATA MIGRATION (OPTIONAL)");
  console.log("   - Jika diputuskan perlu fix historical data");
  console.log("   - Buat script migration untuk recalculate denda");
  console.log("   - Perlu approval dan audit trail");
  console.log();
  console.log("=".repeat(80));
}

auditHistoricalDendaImpact()
  .then(() => {
    console.log("\n✅ Audit selesai");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
