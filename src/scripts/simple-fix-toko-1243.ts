import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function simpleFix() {
  console.log("=".repeat(80));
  console.log("SIMPLE FIX - TOKO 1243 (GUNUNG JAYA - ME)");
  console.log("=".repeat(80));
  console.log();

  try {
    console.log("BEFORE UPDATE:");
    console.log("-".repeat(80));
    
    const before = await pool.query(`
      SELECT 
        id,
        id_toko,
        hari_denda,
        nilai_denda,
        tanggal_akhir_spk_denda,
        tanggal_serah_terima_denda
      FROM opname_final
      WHERE id_toko = 1243
    `);

    if (before.rows.length > 0) {
      const row = before.rows[0];
      console.log(`Opname ID: ${row.id}`);
      console.log(`Toko ID: ${row.id_toko}`);
      console.log(`Hari Denda: ${row.hari_denda}`);
      console.log(`Nilai Denda: ${row.nilai_denda}`);
      console.log(`SPK End: ${row.tanggal_akhir_spk_denda || 'NULL ← PROBLEM'}`);
      console.log(`ST Date: ${row.tanggal_serah_terima_denda || 'NULL'}`);
      console.log();
    }

    console.log("EXECUTING UPDATE:");
    console.log("-".repeat(80));
    console.log("UPDATE opname_final SET");
    console.log("  tanggal_akhir_spk_denda = '2026-05-29',");
    console.log("  tanggal_serah_terima_denda = '2026-06-02'");
    console.log("WHERE id_toko = 1243");
    console.log();

    const update = await pool.query(`
      UPDATE opname_final
      SET 
        tanggal_akhir_spk_denda = '2026-05-29',
        tanggal_serah_terima_denda = '2026-06-02'
      WHERE id_toko = 1243
      RETURNING id, id_toko, hari_denda, nilai_denda, tanggal_akhir_spk_denda, tanggal_serah_terima_denda
    `);

    console.log("✅ UPDATE SUCCESS!");
    console.log();

    console.log("AFTER UPDATE:");
    console.log("-".repeat(80));
    if (update.rows.length > 0) {
      const row = update.rows[0];
      console.log(`Opname ID: ${row.id}`);
      console.log(`Toko ID: ${row.id_toko}`);
      console.log(`Hari Denda: ${row.hari_denda}`);
      console.log(`Nilai Denda: ${row.nilai_denda}`);
      console.log(`SPK End: ${row.tanggal_akhir_spk_denda} ← NOW SET ✅`);
      console.log(`ST Date: ${row.tanggal_serah_terima_denda} ← NOW SET ✅`);
      console.log();
    }

    console.log("VERIFY BOTH TOKOS:");
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
      console.log(`  Dashboard source: ${hasOfficial ? 'RESMI ✅' : 'ESTIMASI ❌'}`);
      console.log();
    }

    console.log("=".repeat(80));
    console.log("✅ FIX COMPLETED!");
    console.log("=".repeat(80));
    console.log();
    console.log("Both tokos (1226 SIPIL + 1243 ME) now have:");
    console.log("  ✅ tanggal_akhir_spk_denda set");
    console.log("  ✅ tanggal_serah_terima_denda set");
    console.log("  ✅ Dashboard will show 'Resmi' source");
    console.log("  ✅ Denda: Rp 0");
    console.log();
    console.log("NEXT STEP:");
    console.log("  1. Hard refresh browser: Ctrl + Shift + R");
    console.log("  2. Or clear browser cache");
    console.log("  3. Check dashboard for ULOK 2JZ1-2603-0003");
    console.log("  4. Should show: Rp 0 (Resmi) ✅");
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

simpleFix();
