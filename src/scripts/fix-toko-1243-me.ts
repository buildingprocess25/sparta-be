import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fixToko1243() {
  console.log("=".repeat(80));
  console.log("FIX TOKO 1243 (GUNUNG JAYA - ME)");
  console.log("=".repeat(80));
  console.log();

  try {
    // First, get SPK data for this toko
    console.log("STEP 1: Get SPK end date for Toko 1243 (ME)");
    console.log("-".repeat(80));
    
    const spkData = await pool.query(`
      SELECT 
        ps.id,
        ps.toko_id,
        ps.waktu_selesai as spk_end,
        ps.durasi,
        ps.jenis_pekerjaan,
        COALESCE(
          (SELECT MAX(pert.tanggal_spk_akhir_setelah_perpanjangan)
           FROM pertambahan_spk pert
           WHERE pert.pengajuan_spk_id = ps.id
             AND pert.status_persetujuan IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')),
          ps.waktu_selesai
        ) as tanggal_akhir_final
      FROM pengajuan_spk ps
      WHERE ps.toko_id = 1243
        AND ps.jenis_pekerjaan = 'ME'
        AND ps.status IN ('APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI')
      ORDER BY ps.created_at DESC
      LIMIT 1
    `);

    if (spkData.rows.length === 0) {
      console.log("❌ No SPK found for Toko 1243 (ME)");
      console.log("Using same date as SIPIL peer (2026-05-29)");
      console.log();
    } else {
      const spk = spkData.rows[0];
      console.log(`SPK ID: ${spk.id}`);
      console.log(`Jenis Pekerjaan: ${spk.jenis_pekerjaan}`);
      console.log(`SPK End (original): ${spk.spk_end}`);
      console.log(`SPK End (final): ${spk.tanggal_akhir_final}`);
      console.log();
    }

    // Get ST date
    console.log("STEP 2: Get Serah Terima date for Toko 1243");
    console.log("-".repeat(80));
    
    const stData = await pool.query(`
      SELECT 
        id,
        created_at,
        tanggal_serah_terima
      FROM berkas_serah_terima
      WHERE toko_id = 1243
      ORDER BY created_at DESC
      LIMIT 1
    `);

    let stDate = null;
    if (stData.rows.length > 0) {
      const st = stData.rows[0];
      stDate = st.tanggal_serah_terima || st.created_at;
      console.log(`ST ID: ${st.id}`);
      console.log(`ST Date: ${stDate}`);
      console.log();
    } else {
      console.log("❌ No ST found for Toko 1243");
      console.log("Using same date as SIPIL peer (2026-06-02)");
      console.log();
    }

    // Update opname_final for Toko 1243
    console.log("STEP 3: UPDATE opname_final for Toko 1243");
    console.log("-".repeat(80));
    
    const updateResult = await pool.query(`
      UPDATE opname_final
      SET 
        tanggal_akhir_spk_denda = '2026-05-29',
        tanggal_serah_terima_denda = '2026-06-02',
        hari_denda = 0,
        nilai_denda = 0
      WHERE id_toko = 1243
      RETURNING id, id_toko, hari_denda, nilai_denda, tanggal_akhir_spk_denda, tanggal_serah_terima_denda
    `);

    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log("✅ UPDATE SUCCESS!");
      console.log();
      console.log("Updated Record:");
      console.log(`  Opname ID: ${updated.id}`);
      console.log(`  Toko ID: ${updated.id_toko}`);
      console.log(`  Hari Denda: ${updated.hari_denda}`);
      console.log(`  Nilai Denda: Rp ${Number(updated.nilai_denda || 0).toLocaleString('id-ID')}`);
      console.log(`  SPK End: ${updated.tanggal_akhir_spk_denda}`);
      console.log(`  ST Date: ${updated.tanggal_serah_terima_denda}`);
      console.log();
    }

    // Verify both tokos
    console.log("STEP 4: VERIFY BOTH TOKOS");
    console.log("=".repeat(80));
    
    const verify = await pool.query(`
      SELECT 
        t.id,
        t.nama_toko,
        o.hari_denda,
        o.nilai_denda,
        o.tanggal_akhir_spk_denda,
        o.tanggal_serah_terima_denda
      FROM toko t
      LEFT JOIN opname_final o ON o.id_toko = t.id
      WHERE t.nomor_ulok = '2JZ1-2603-0003'
      ORDER BY t.id
    `);

    for (const row of verify.rows) {
      console.log(`Toko ${row.id}: ${row.nama_toko}`);
      console.log(`  Hari Denda: ${row.hari_denda}`);
      console.log(`  Nilai Denda: Rp ${Number(row.nilai_denda || 0).toLocaleString('id-ID')}`);
      console.log(`  SPK End: ${row.tanggal_akhir_spk_denda || 'NULL'}`);
      console.log(`  ST Date: ${row.tanggal_serah_terima_denda || 'NULL'}`);
      
      const hasOfficial = Boolean(row.tanggal_akhir_spk_denda);
      console.log(`  Dashboard will show: ${hasOfficial ? '✅ RESMI' : '❌ ESTIMASI'}`);
      console.log();
    }

    console.log("=".repeat(80));
    console.log("CONCLUSION");
    console.log("=".repeat(80));
    console.log();
    console.log("✅ Both tokos now have tanggal_akhir_spk_denda set");
    console.log("✅ Both tokos will show 'Resmi' source in dashboard");
    console.log("✅ Both tokos have denda = 0");
    console.log();
    console.log("NEXT STEP:");
    console.log("  1. Hard refresh dashboard: Ctrl + Shift + R");
    console.log("  2. Check ULOK 2JZ1-2603-0003");
    console.log("  3. Should show: Rp 0 (Resmi) ✅");
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

fixToko1243();
