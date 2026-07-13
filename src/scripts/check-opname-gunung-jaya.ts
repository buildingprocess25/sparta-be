import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkOpnameGunungJaya() {
  console.log("=".repeat(80));
  console.log("CHECK OPNAME_FINAL - GUNUNG JAYA (2JZ1-2603-0003)");
  console.log("=".repeat(80));
  console.log();

  try {
    const result = await pool.query(`
      SELECT 
        t.id as toko_id,
        t.nomor_ulok,
        t.nama_toko,
        t.cabang,
        o.id as opname_id,
        o.hari_denda,
        o.nilai_denda,
        o.tanggal_akhir_spk_denda,
        o.tanggal_serah_terima_denda,
        o.status_opname_final,
        o.created_at
      FROM toko t
      LEFT JOIN opname_final o ON o.id_toko = t.id
      WHERE t.nomor_ulok = '2JZ1-2603-0003'
      ORDER BY t.nama_toko
    `);

    for (const row of result.rows) {
      console.log(`Toko ID: ${row.toko_id}`);
      console.log(`Nama: ${row.nama_toko}`);
      console.log(`Cabang: ${row.cabang}`);
      console.log();
      
      console.log("OPNAME_FINAL DATA:");
      console.log(`  ID: ${row.opname_id || 'NULL - NO OPNAME!'}`);
      console.log(`  Hari Denda: ${row.hari_denda ?? 'NULL'}`);
      console.log(`  Nilai Denda: Rp ${Number(row.nilai_denda || 0).toLocaleString('id-ID')}`);
      console.log(`  tanggal_akhir_spk_denda: ${row.tanggal_akhir_spk_denda || 'NULL ← KEY ISSUE!'}`);
      console.log(`  tanggal_serah_terima_denda: ${row.tanggal_serah_terima_denda || 'NULL'}`);
      console.log(`  Status: ${row.status_opname_final || 'NULL'}`);
      console.log(`  Created: ${row.created_at || 'NULL'}`);
      console.log();

      // Dashboard logic simulation
      const hasOfficialCalculation = Boolean(row.tanggal_akhir_spk_denda);
      console.log("DASHBOARD WILL SHOW:");
      if (hasOfficialCalculation) {
        console.log(`  ✅ Source: RESMI`);
        console.log(`  ✅ Denda: Rp ${Number(row.nilai_denda || 0).toLocaleString('id-ID')}`);
        console.log(`  ✅ Hari: ${row.hari_denda || 0}`);
      } else {
        console.log(`  ❌ Source: ESTIMASI ← PROBLEM!`);
        console.log(`  ❌ Will calculate from SPK dates (ignores database)`);
        console.log(`  ❌ This is why dashboard shows Rp 1.000.000!`);
      }
      console.log();
      console.log("=".repeat(80));
      console.log();
    }

    console.log("ROOT CAUSE:");
    console.log("-".repeat(80));
    console.log("opname_final.tanggal_akhir_spk_denda is NULL for this ULOK");
    console.log();
    console.log("Dashboard logic (dashboard.presentation.ts line 145):");
    console.log("  const hasOfficialCalculation = Boolean(opname?.tanggal_akhir_spk_denda);");
    console.log();
    console.log("  if (official > 0 || officialHari > 0 || hasOfficialCalculation) {");
    console.log("    return { source: 'Resmi', ... }  ← We want this");
    console.log("  }");
    console.log("  // Falls through to ESTIMASI ← Currently happening");
    console.log();
    console.log("SOLUTION:");
    console.log("-".repeat(80));
    console.log("Need to UPDATE opname_final SET:");
    console.log("  - tanggal_akhir_spk_denda = '2026-05-29' (SPK end date)");
    console.log("  - tanggal_serah_terima_denda = '2026-06-02' (ST date)");
    console.log();
    console.log("This will trigger 'Resmi' calculation in dashboard.");
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkOpnameGunungJaya();
