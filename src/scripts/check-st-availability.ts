import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkStAvailability() {
  console.log("=".repeat(80));
  console.log("CHECK ST AVAILABILITY - 61 NULL RECORDS");
  console.log("=".repeat(80));
  console.log();

  try {
    // Get all 61 records with NULL tanggal_akhir_spk_denda
    const nullRecords = await pool.query(`
      SELECT 
        t.id as toko_id,
        t.nomor_ulok,
        t.nama_toko,
        t.cabang,
        o.id as opname_id,
        o.tanggal_serah_terima_denda
      FROM toko t
      JOIN opname_final o ON o.id_toko = t.id
      WHERE o.tanggal_akhir_spk_denda IS NULL
        AND EXTRACT(YEAR FROM o.created_at) = 2026
      ORDER BY t.nomor_ulok
    `);

    console.log(`Total records with NULL tanggal_akhir_spk_denda: ${nullRecords.rows.length}`);
    console.log();

    // Check which ones have ST in berkas_serah_terima
    console.log("Checking berkas_serah_terima for each toko...");
    console.log();

    let hasStCount = 0;
    let noStCount = 0;
    const withSt: any[] = [];
    const withoutSt: any[] = [];

    for (const record of nullRecords.rows) {
      const stResult = await pool.query(`
        SELECT 
          id,
          created_at
        FROM berkas_serah_terima
        WHERE toko_id = $1
        ORDER BY created_at ASC
        LIMIT 1
      `, [record.toko_id]);

      if (stResult.rows.length > 0) {
        hasStCount++;
        withSt.push({
          ...record,
          st_id: stResult.rows[0].id,
          st_date: stResult.rows[0].created_at
        });
      } else {
        noStCount++;
        withoutSt.push(record);
      }
    }

    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log();
    console.log(`Total records: ${nullRecords.rows.length}`);
    console.log(`With ST in berkas_serah_terima: ${hasStCount}`);
    console.log(`Without ST: ${noStCount}`);
    console.log();

    if (noStCount > 0) {
      console.log("=".repeat(80));
      console.log(`RECORDS WITHOUT ST (${noStCount}):`);
      console.log("=".repeat(80));
      console.log();

      // Group by status
      const byStatus: Record<string, any[]> = {
        'Proses KTK/Approval Kontraktor': [],
        'Disetujui': [],
        'Ditolak oleh Koordinator': [],
        'Menunggu Persetujuan Koordinator': [],
        'Other': []
      };

      for (const record of withoutSt) {
        const statusResult = await pool.query(`
          SELECT status_opname_final
          FROM opname_final
          WHERE id = $1
        `, [record.opname_id]);

        const status = statusResult.rows[0]?.status_opname_final || 'Other';
        if (byStatus[status]) {
          byStatus[status].push(record);
        } else {
          byStatus['Other'].push(record);
        }
      }

      for (const [status, records] of Object.entries(byStatus)) {
        if (records.length > 0) {
          console.log(`${status}: ${records.length} records`);
          for (const rec of records.slice(0, 5)) {
            console.log(`  - ${rec.nomor_ulok} (${rec.cabang}) - Toko ${rec.toko_id}`);
          }
          if (records.length > 5) {
            console.log(`  ... and ${records.length - 5} more`);
          }
          console.log();
        }
      }
    }

    if (hasStCount > 0) {
      console.log("=".repeat(80));
      console.log(`RECORDS WITH ST (${hasStCount}):`);
      console.log("=".repeat(80));
      console.log();
      console.log("These can be fixed with re-calculation.");
      console.log();

      // Show first 10
      for (const rec of withSt.slice(0, 10)) {
        console.log(`${rec.nomor_ulok.padEnd(20)} | ${rec.cabang.padEnd(15)} | ST: ${rec.st_date}`);
      }
      if (hasStCount > 10) {
        console.log(`... and ${hasStCount - 10} more`);
      }
      console.log();
    }

    console.log("=".repeat(80));
    console.log("CONCLUSION");
    console.log("=".repeat(80));
    console.log();
    
    if (noStCount === 0) {
      console.log("✅ All 61 records have ST data!");
      console.log("✅ Safe to run fix script for all records");
    } else {
      console.log(`⚠️  ${noStCount} records don't have ST yet`);
      console.log("These records are likely still in progress (not yet delivered).");
      console.log();
      console.log("Strategy:");
      console.log(`  1. Fix ${hasStCount} records that have ST data`);
      console.log(`  2. Skip ${noStCount} records without ST (will be calculated when ST is uploaded)`);
    }
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkStAvailability();
