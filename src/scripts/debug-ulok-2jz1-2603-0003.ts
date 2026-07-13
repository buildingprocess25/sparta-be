/**
 * DEBUG ULOK 2JZ1-2603-0003: Kenapa masih denda 1 hari?
 */

import { pool } from "../db/pool";
import { calculateDendaFromDates } from "../modules/denda/denda-keterlambatan";

async function debugUlok() {
    console.log("=".repeat(80));
    console.log("DEBUG: ULOK 2JZ1-2603-0003 - GUNUNG JAYA");
    console.log("=".repeat(80));
    console.log("");

    const ulok = "2JZ1-2603-0003";

    // Query full data
    const result = await pool.query(`
        SELECT 
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.cabang,
            -- SPK End Date
            COALESCE(
                (
                    SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)::date
                    FROM pertambahan_spk pt
                    WHERE pt.id_spk = ps.id
                      AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                ),
                ps.waktu_selesai::date
            ) AS spk_end,
            ps.waktu_selesai AS spk_waktu_selesai_raw,
            -- ST Date
            bst.id AS bst_id,
            bst.created_at AS st_date,
            -- Opname Final (current values in DB)
            of.id AS id_opname_final,
            of.hari_denda AS current_hari_denda,
            of.nilai_denda AS current_nilai_denda,
            of.created_at AS opname_created_at
        FROM toko t
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        LEFT JOIN opname_final of ON of.id_toko = t.id
        WHERE t.nomor_ulok = $1
          AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
        ORDER BY ps.id DESC
        LIMIT 1
    `, [ulok]);

    if (result.rows.length === 0) {
        console.log("❌ ULOK not found!");
        return;
    }

    const row = result.rows[0];
    
    console.log("📊 DATABASE VALUES:");
    console.log("-".repeat(80));
    console.log(`ULOK: ${row.nomor_ulok}`);
    console.log(`Toko: ${row.nama_toko}`);
    console.log(`Cabang: ${row.cabang}`);
    console.log("");
    
    console.log(`SPK End: ${row.spk_end}`);
    console.log(`SPK Waktu Selesai (raw): ${row.spk_waktu_selesai_raw}`);
    console.log("");
    
    console.log(`ST Date: ${row.st_date}`);
    console.log(`ST ID: ${row.bst_id}`);
    console.log("");
    
    console.log(`Current Denda (DB):`);
    console.log(`  - Hari Denda: ${row.current_hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${parseInt(row.current_nilai_denda || 0).toLocaleString('id-ID')}`);
    console.log(`  - Created At: ${row.opname_created_at}`);
    console.log("");

    // Re-calculate dengan logic BARU (libur nasional)
    const spkEnd = new Date(row.spk_end);
    const stDate = new Date(row.st_date);

    console.log("🔄 RE-CALCULATE dengan Logic Libur Nasional:");
    console.log("-".repeat(80));
    
    const calculated = calculateDendaFromDates(spkEnd, stDate);
    
    console.log(`SPK End: ${spkEnd.toISOString().split('T')[0]}`);
    console.log(`ST Date: ${stDate.toISOString().split('T')[0]}`);
    console.log("");
    console.log(`Calculated:`);
    console.log(`  - Hari Denda: ${calculated.hari_denda}`);
    console.log(`  - Nilai Denda: Rp ${calculated.nilai_denda.toLocaleString('id-ID')}`);
    console.log(`  - Grace Date: ${calculated.tanggal_akhir_spk}`);
    console.log("");

    // Compare
    const currentDenda = parseInt(row.current_nilai_denda || 0);
    const newDenda = calculated.nilai_denda;

    console.log("📊 COMPARISON:");
    console.log("-".repeat(80));
    console.log(`Database (OLD): ${row.current_hari_denda} hari = Rp ${currentDenda.toLocaleString('id-ID')}`);
    console.log(`Calculated (NEW): ${calculated.hari_denda} hari = Rp ${newDenda.toLocaleString('id-ID')}`);
    console.log("");

    if (currentDenda !== newDenda) {
        console.log("⚠️  MISMATCH DETECTED!");
        console.log(`   Difference: Rp ${(currentDenda - newDenda).toLocaleString('id-ID')}`);
        console.log("");
        console.log("🔧 ACTION REQUIRED:");
        console.log("   1. Update opname_final table");
        console.log("   2. OR deploy new backend (if not deployed yet)");
        console.log("   3. OR clear cache");
    } else {
        console.log("✅ Values MATCH - Database is correct!");
    }

    console.log("");
    console.log("=".repeat(80));
}

debugUlok()
    .then(() => {
        console.log("✅ Debug complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
