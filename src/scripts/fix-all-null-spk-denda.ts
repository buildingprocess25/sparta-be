import pg from "pg";
import "dotenv/config";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fixAllNullSpkDenda() {
  console.log("=".repeat(80));
  console.log("FIX ALL NULL tanggal_akhir_spk_denda RECORDS");
  console.log("=".repeat(80));
  console.log();

  try {
    // Get all records with NULL tanggal_akhir_spk_denda
    console.log("STEP 1: Finding all records with NULL tanggal_akhir_spk_denda...");
    console.log("-".repeat(80));
    
    const nullRecords = await pool.query(`
      SELECT 
        t.id as toko_id,
        t.nomor_ulok,
        t.nama_toko,
        t.cabang,
        o.id as opname_id,
        o.hari_denda,
        o.nilai_denda,
        o.tanggal_akhir_spk_denda,
        o.tanggal_serah_terima_denda
      FROM toko t
      JOIN opname_final o ON o.id_toko = t.id
      WHERE o.tanggal_akhir_spk_denda IS NULL
        AND EXTRACT(YEAR FROM o.created_at) = 2026
      ORDER BY t.nomor_ulok
    `);

    console.log(`Found ${nullRecords.rows.length} records to fix`);
    console.log();

    // For each record, calculate denda properly using the service
    console.log("STEP 2: Re-calculating denda for each record with proper logic...");
    console.log("-".repeat(80));
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const record of nullRecords.rows) {
      try {
        console.log(`Processing ${record.nomor_ulok} (Toko ${record.toko_id})...`);
        
        // Calculate denda using the proper service (includes national holidays logic)
        const denda = await calculateDendaByTokoId(record.toko_id);

        // Check if calculation succeeded (has at least tanggal_akhir_spk)
        if (!denda.tanggal_akhir_spk) {
          console.log(`  ⚠️  Skipped - No SPK data found`);
          skippedCount++;
          continue;
        }

        // Update opname_final with calculated values
        await pool.query(`
          UPDATE opname_final
          SET 
            hari_denda = $1,
            nilai_denda = $2,
            tanggal_akhir_spk_denda = $3,
            tanggal_serah_terima_denda = $4
          WHERE id = $5
        `, [
          denda.hari_denda,
          denda.nilai_denda,
          denda.tanggal_akhir_spk,
          denda.tanggal_serah_terima,
          record.opname_id
        ]);

        successCount++;
        console.log(`  ✅ Updated - Hari: ${denda.hari_denda}, Denda: Rp ${denda.nilai_denda.toLocaleString('id-ID')}`);
      } catch (error) {
        errorCount++;
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    console.log();
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log();
    console.log(`Total records found: ${nullRecords.rows.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Skipped (no SPK data): ${skippedCount}`);
    console.log();

    // Verify
    console.log("STEP 3: Verifying updates...");
    console.log("-".repeat(80));
    
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as remaining
      FROM opname_final o
      WHERE o.tanggal_akhir_spk_denda IS NULL
        AND EXTRACT(YEAR FROM o.created_at) = 2026
    `);

    const remaining = Number(verifyResult.rows[0]?.remaining || 0);
    console.log(`Remaining records with NULL tanggal_akhir_spk_denda: ${remaining}`);
    console.log();

    if (remaining === 0) {
      console.log("✅ ALL RECORDS FIXED!");
      console.log("✅ All opname_final records now have tanggal_akhir_spk_denda set");
      console.log("✅ Dashboard will show 'Resmi' source for all records");
    } else {
      console.log(`⚠️  ${remaining} records still have NULL tanggal_akhir_spk_denda`);
      console.log("These records are missing SPK or ST dates in database.");
    }
    console.log();

    console.log("=".repeat(80));
    console.log("NEXT STEPS");
    console.log("=".repeat(80));
    console.log();
    console.log("1. Hard refresh dashboard: Ctrl + Shift + R");
    console.log("2. Check affected ULOKs");
    console.log("3. All should now show 'Resmi' source instead of 'Estimasi'");
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

fixAllNullSpkDenda();
