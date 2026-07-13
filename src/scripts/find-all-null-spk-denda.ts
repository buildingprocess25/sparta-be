import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function findAllNullSpkDenda() {
  console.log("=".repeat(80));
  console.log("FIND ALL OPNAME_FINAL WITH NULL tanggal_akhir_spk_denda");
  console.log("=".repeat(80));
  console.log();

  try {
    // Find all opname_final records where tanggal_akhir_spk_denda is NULL
    // but hari_denda and nilai_denda are set (meaning calculation was done)
    console.log("Searching for records with NULL tanggal_akhir_spk_denda...");
    console.log();

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
        o.status_opname_final
      FROM toko t
      JOIN opname_final o ON o.id_toko = t.id
      WHERE o.tanggal_akhir_spk_denda IS NULL
        AND EXTRACT(YEAR FROM o.created_at) = 2026
      ORDER BY t.cabang, t.nomor_ulok
    `);

    console.log(`Found ${result.rows.length} records with NULL tanggal_akhir_spk_denda`);
    console.log();

    if (result.rows.length === 0) {
      console.log("✅ No records found with NULL tanggal_akhir_spk_denda");
      console.log("All opname_final records have the field properly set.");
      return;
    }

    console.log("=".repeat(80));
    console.log("DETAILED LIST");
    console.log("=".repeat(80));
    console.log();

    // Group by ULOK
    const byUlok: Record<string, typeof result.rows> = {};
    for (const row of result.rows) {
      if (!byUlok[row.nomor_ulok]) {
        byUlok[row.nomor_ulok] = [];
      }
      byUlok[row.nomor_ulok].push(row);
    }

    let ulokCount = 0;
    for (const [ulok, records] of Object.entries(byUlok)) {
      ulokCount++;
      console.log(`${ulokCount}. ULOK: ${ulok}`);
      console.log(`   Cabang: ${records[0].cabang}`);
      console.log(`   Tokos: ${records.length}`);
      console.log();

      for (const record of records) {
        console.log(`   Toko ID: ${record.toko_id} - ${record.nama_toko}`);
        console.log(`     Opname ID: ${record.opname_id}`);
        console.log(`     Hari Denda: ${record.hari_denda ?? 'NULL'}`);
        console.log(`     Nilai Denda: Rp ${Number(record.nilai_denda || 0).toLocaleString('id-ID')}`);
        console.log(`     SPK End: ${record.tanggal_akhir_spk_denda || 'NULL ← PROBLEM'}`);
        console.log(`     ST Date: ${record.tanggal_serah_terima_denda || 'NULL'}`);
        console.log(`     Status: ${record.status_opname_final}`);
        console.log();
      }
      console.log("-".repeat(80));
    }

    // Summary
    console.log();
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log();
    console.log(`Total ULOKs affected: ${Object.keys(byUlok).length}`);
    console.log(`Total Tokos affected: ${result.rows.length}`);
    console.log();

    // Group by cabang
    const byCabang: Record<string, number> = {};
    for (const row of result.rows) {
      byCabang[row.cabang] = (byCabang[row.cabang] || 0) + 1;
    }

    console.log("By Cabang:");
    for (const [cabang, count] of Object.entries(byCabang).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cabang.padEnd(20)}: ${count} tokos`);
    }
    console.log();

    console.log("=".repeat(80));
    console.log("IMPACT");
    console.log("=".repeat(80));
    console.log();
    console.log("These records will show 'ESTIMASI' in dashboard instead of 'RESMI'");
    console.log("because tanggal_akhir_spk_denda is NULL.");
    console.log();
    console.log("Dashboard logic:");
    console.log("  const hasOfficialCalculation = Boolean(opname?.tanggal_akhir_spk_denda);");
    console.log("  if (!hasOfficialCalculation) {");
    console.log("    // Falls through to ESTIMASI calculation");
    console.log("    // This ignores the database values and recalculates");
    console.log("  }");
    console.log();

    console.log("=".repeat(80));
    console.log("NEXT STEPS");
    console.log("=".repeat(80));
    console.log();
    console.log("Need to UPDATE these records with proper tanggal_akhir_spk_denda");
    console.log("and tanggal_serah_terima_denda values.");
    console.log();
    console.log("This will ensure dashboard shows 'Resmi' source instead of 'Estimasi'.");
    console.log();

    // Save to file for reference
    console.log("Saving list to file: NULL-SPK-DENDA-RECORDS.txt");
    const fs = require('fs');
    const output = Object.entries(byUlok).map(([ulok, records]) => {
      return `${ulok} (${records[0].cabang}) - ${records.length} tokos:\n` +
        records.map(r => `  - Toko ${r.toko_id}: ${r.nama_toko} (Opname ${r.opname_id})`).join('\n');
    }).join('\n\n');
    
    fs.writeFileSync('NULL-SPK-DENDA-RECORDS.txt', output);
    console.log("✅ List saved!");
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

findAllNullSpkDenda();
