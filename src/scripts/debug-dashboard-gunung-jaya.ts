import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function debugDashboard() {
  console.log("=".repeat(80));
  console.log("DEBUG DASHBOARD - GUNUNG JAYA (2JZ1-2603-0003)");
  console.log("=".repeat(80));
  console.log();

  try {
    // Check complete data for this ULOK
    const result = await pool.query(`
      SELECT 
        t.id,
        t.nomor_ulok,
        t.nama_toko,
        t.cabang,
        t.jenis_pekerjaan,
        -- Opname Final data
        o.id as opname_id,
        o.hari_denda,
        o.nilai_denda,
        o.tanggal_akhir_spk_denda,
        o.tanggal_serah_terima_denda,
        o.status_opname_final,
        o.created_at as opname_created_at,
        -- SPK data
        s.id as spk_id,
        s.waktu_selesai as spk_end,
        s.durasi as spk_durasi,
        s.status as spk_status,
        -- Berkas ST data
        b.id as berkas_st_id,
        b.created_at as st_created_at,
        b.tanggal_serah_terima as st_date
      FROM toko t
      LEFT JOIN opname_final o ON o.id_toko = t.id
      LEFT JOIN spk s ON s.toko_id = t.id
      LEFT JOIN berkas_serah_terima b ON b.toko_id = t.id
      WHERE t.nomor_ulok = '2JZ1-2603-0003'
      ORDER BY t.jenis_pekerjaan, s.created_at DESC
    `);

    console.log(`Found ${result.rows.length} records for ULOK 2JZ1-2603-0003`);
    console.log();

    for (const row of result.rows) {
      console.log("=".repeat(80));
      console.log(`TOKO ID: ${row.id}`);
      console.log(`Nama: ${row.nama_toko}`);
      console.log(`Jenis Pekerjaan: ${row.jenis_pekerjaan}`);
      console.log(`Cabang: ${row.cabang}`);
      console.log();
      
      console.log("OPNAME_FINAL:");
      console.log(`  - Opname ID: ${row.opname_id || 'NULL'}`);
      console.log(`  - Hari Denda: ${row.hari_denda ?? 'NULL'}`);
      console.log(`  - Nilai Denda: ${row.nilai_denda || 'NULL'}`);
      console.log(`  - SPK End (denda): ${row.tanggal_akhir_spk_denda || 'NULL'} ← KEY FIELD`);
      console.log(`  - ST Date (denda): ${row.tanggal_serah_terima_denda || 'NULL'}`);
      console.log(`  - Status: ${row.status_opname_final || 'NULL'}`);
      console.log(`  - Created: ${row.opname_created_at || 'NULL'}`);
      console.log();

      console.log("SPK:");
      console.log(`  - SPK ID: ${row.spk_id || 'NULL'}`);
      console.log(`  - Waktu Selesai: ${row.spk_end || 'NULL'}`);
      console.log(`  - Durasi: ${row.spk_durasi || 'NULL'} hari`);
      console.log(`  - Status: ${row.spk_status || 'NULL'}`);
      console.log();

      console.log("BERKAS SERAH TERIMA:");
      console.log(`  - Berkas ID: ${row.berkas_st_id || 'NULL'}`);
      console.log(`  - Created: ${row.st_created_at || 'NULL'}`);
      console.log(`  - Tanggal ST: ${row.st_date || 'NULL'}`);
      console.log();

      // Dashboard logic check
      const hasOfficialCalculation = Boolean(row.tanggal_akhir_spk_denda);
      console.log("DASHBOARD LOGIC:");
      console.log(`  - hasOfficialCalculation: ${hasOfficialCalculation}`);
      
      if (hasOfficialCalculation) {
        console.log(`  - Source: RESMI`);
        console.log(`  - Amount: Rp ${Number(row.nilai_denda || 0).toLocaleString('id-ID')}`);
        console.log(`  - Days: ${row.hari_denda || 0}`);
      } else {
        console.log(`  - Source: ESTIMASI ← PROBLEM!`);
        console.log(`  - Will calculate from SPK end date vs ST date`);
      }
      console.log();
    }

    // Check if there are multiple toko for this ULOK
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    
    const summary = await pool.query(`
      SELECT 
        t.id,
        t.jenis_pekerjaan,
        o.tanggal_akhir_spk_denda,
        o.hari_denda,
        o.nilai_denda
      FROM toko t
      LEFT JOIN opname_final o ON o.id_toko = t.id
      WHERE t.nomor_ulok = '2JZ1-2603-0003'
      ORDER BY t.jenis_pekerjaan
    `);

    for (const row of summary.rows) {
      console.log(`Toko ${row.id} (${row.jenis_pekerjaan}):`);
      console.log(`  tanggal_akhir_spk_denda: ${row.tanggal_akhir_spk_denda || 'NULL ← MUST BE SET!'}`);
      console.log(`  hari_denda: ${row.hari_denda ?? 'NULL'}`);
      console.log(`  nilai_denda: ${row.nilai_denda || 'NULL'}`);
      console.log();
    }

    console.log("=".repeat(80));
    console.log("ROOT CAUSE");
    console.log("=".repeat(80));
    console.log();
    console.log("Dashboard shows 'Estimasi' because:");
    console.log("  1. opname_final.tanggal_akhir_spk_denda is NULL");
    console.log("  2. Dashboard checks: hasOfficialCalculation = Boolean(tanggal_akhir_spk_denda)");
    console.log("  3. If FALSE → uses ESTIMASI calculation (old logic)");
    console.log("  4. If TRUE → uses RESMI from database");
    console.log();
    console.log("SOLUTION:");
    console.log("  Need to UPDATE opname_final SET tanggal_akhir_spk_denda for this ULOK");
    console.log("  Even if denda = 0, the field MUST be populated for 'Resmi' source");
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

debugDashboard();
