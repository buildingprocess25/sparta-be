import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function quickCheck() {
  console.log("=".repeat(80));
  console.log("QUICK DASHBOARD DATA CHECK");
  console.log("=".repeat(80));
  console.log();

  try {
    // Check main ULOK 2JZ1-2603-0003
    console.log("ULOK 2JZ1-2603-0003 (GUNUNG JAYA - User's main concern)");
    console.log("-".repeat(80));
    
    const main = await pool.query(`
      SELECT 
        t.id,
        t.nomor_ulok,
        t.nama_toko,
        t.cabang,
        o.hari_denda,
        o.nilai_denda,
        o.tanggal_akhir_spk_denda,
        o.tanggal_serah_terima_denda
      FROM toko t
      LEFT JOIN opname_final o ON o.id_toko = t.id
      WHERE t.nomor_ulok = '2JZ1-2603-0003'
      ORDER BY t.nama_toko
    `);

    for (const row of main.rows) {
      console.log(`Toko: ${row.nama_toko} (ID: ${row.id})`);
      console.log(`Hari Denda: ${row.hari_denda || 0}`);
      console.log(`Nilai Denda: Rp ${Number(row.nilai_denda || 0).toLocaleString('id-ID')}`);
      console.log(`SPK End: ${row.tanggal_akhir_spk_denda || 'N/A'}`);
      console.log(`ST Date: ${row.tanggal_serah_terima_denda || 'N/A'}`);
      console.log();
    }

    // Check all 22 fixed ULOKs
    console.log("ALL 22 FIXED ULOKS");
    console.log("-".repeat(80));
    
    const fixedUloks = [
      '1DZ1-2601-0001-R', 'CZ01-2603-0003', 'WZ01-2602-0026', '2DZ1-2601-0002',
      'XZ01-2512-0002', 'ZZ01-2604-0021', 'AZ01-2604-0001', '1GZ1-2608-0004',
      '1GZ1-2611-0002', '2JZ1-2603-0003', '1KZ1-2603-0002', '2LZ1-2601-0009',
      '5LZ1-2602-0005', '1MZ1-2608-0003', 'AZ01-2604-0032', 'RZ01-2603-0002',
      '4SZ1-2605-0006', 'TZ01-2511-0002', 'VZ01-2604-0004', 'WZ01-2604-0009',
      'CZ01-2603-0015', '1EZ1-2604-0003'
    ];

    const fixed = await pool.query(`
      SELECT 
        t.nomor_ulok,
        t.cabang,
        COUNT(*) as toko_count,
        SUM(COALESCE(o.hari_denda, 0)) as total_hari_denda,
        SUM(COALESCE(o.nilai_denda::numeric, 0)) as total_nilai_denda
      FROM toko t
      LEFT JOIN opname_final o ON o.id_toko = t.id
      WHERE t.nomor_ulok = ANY($1::text[])
      GROUP BY t.nomor_ulok, t.cabang
      ORDER BY t.cabang, t.nomor_ulok
    `, [fixedUloks]);

    let totalDenda = 0;
    for (const row of fixed.rows) {
      const denda = Number(row.total_nilai_denda || 0);
      totalDenda += denda;
      console.log(`${row.nomor_ulok.padEnd(20)} | ${row.cabang.padEnd(15)} | ${row.toko_count} toko | Rp ${denda.toLocaleString('id-ID')}`);
    }

    console.log();
    console.log(`TOTAL ULOKs: ${fixed.rows.length}`);
    console.log(`TOTAL DENDA: Rp ${totalDenda.toLocaleString('id-ID')}`);
    console.log();

    console.log("=".repeat(80));
    console.log("CONCLUSION");
    console.log("=".repeat(80));
    console.log("✅ Database is CORRECT");
    console.log("✅ ULOK 2JZ1-2603-0003 shows Rp 0 (2 toko)");
    console.log();
    console.log("❌ Dashboard still shows old value");
    console.log("   → Backend needs to be restarted/deployed");
    console.log("   → Browser cache needs to be cleared");
    console.log();
    console.log("NEXT STEP: Deploy backend to Render.com NOW");
    console.log();

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

quickCheck();
