/**
 * REALTIME CHECK: ULOK 2JZ1-2603-0003
 * Cek current state di database dan calculation
 */

import { pool } from "../db/pool";
import { calculateDendaByTokoId } from "../modules/denda/denda-keterlambatan";

async function checkRealtime() {
    console.log("================================================================================");
    console.log("REALTIME CHECK: ULOK 2JZ1-2603-0003");
    console.log("================================================================================");
    console.log("");

    const ulok = "2JZ1-2603-0003";

    // Query database lengkap
    const result = await pool.query(`
        SELECT 
            t.id AS id_toko,
            t.nomor_ulok,
            t.nama_toko,
            t.lingkup_pekerjaan,
            t.cabang,
            ps.waktu_selesai::date AS spk_end,
            bst.created_at::date AS st_date,
            of.hari_denda AS opname_hari_denda,
            of.nilai_denda AS opname_nilai_denda,
            of.tanggal_akhir_spk_denda,
            of.tanggal_serah_terima_denda
        FROM toko t
        JOIN pengajuan_spk ps ON ps.id_toko = t.id
        LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
        LEFT JOIN opname_final of ON of.id_toko = t.id
        WHERE t.nomor_ulok = $1
          AND UPPER(TRIM(COALESCE(ps.status, ''))) IN ('SPK_APPROVED', 'APPROVED', 'DISETUJUI', 'AKTIF', 'ACTIVE', 'SELESAI')
        ORDER BY t.id
    `, [ulok]);

    if (result.rows.length === 0) {
        console.log("❌ ULOK not found!");
        return;
    }

    console.log(`Found ${result.rows.length} toko(s) for ULOK ${ulok}:`);
    console.log("");

    for (const row of result.rows) {
        console.log("─".repeat(80));
        console.log(`Toko ID: ${row.id_toko}`);
        console.log(`Nama: ${row.nama_toko}`);
        console.log(`Lingkup: ${row.lingkup_pekerjaan}`);
        console.log(`Cabang: ${row.cabang}`);
        console.log("");
        console.log(`SPK End: ${row.spk_end}`);
        console.log(`ST Date: ${row.st_date}`);
        console.log("");
        console.log("DATABASE (opname_final):");
        console.log(`  Hari Denda: ${row.opname_hari_denda}`);
        console.log(`  Nilai Denda: Rp ${parseInt(row.opname_nilai_denda || 0).toLocaleString('id-ID')}`);
        console.log(`  Tanggal Akhir SPK: ${row.tanggal_akhir_spk_denda || 'null'}`);
        console.log(`  Tanggal ST: ${row.tanggal_serah_terima_denda || 'null'}`);
        console.log("");

        // Calculate real-time
        try {
            const calculated = await calculateDendaByTokoId(row.id_toko);
            console.log("CALCULATED (with national holidays logic):");
            console.log(`  Hari Denda: ${calculated.hari_denda}`);
            console.log(`  Nilai Denda: Rp ${calculated.nilai_denda.toLocaleString('id-ID')}`);
            console.log(`  Tanggal Akhir SPK: ${calculated.tanggal_akhir_spk}`);
            console.log(`  Tanggal ST: ${calculated.tanggal_serah_terima}`);
            console.log("");

            // Compare
            const dbDenda = parseInt(row.opname_nilai_denda || 0);
            const calcDenda = calculated.nilai_denda;

            if (dbDenda === calcDenda) {
                console.log("✅ DATABASE MATCH CALCULATION");
            } else {
                console.log("❌ MISMATCH!");
                console.log(`   Database: Rp ${dbDenda.toLocaleString('id-ID')}`);
                console.log(`   Calculated: Rp ${calcDenda.toLocaleString('id-ID')}`);
                console.log(`   Difference: Rp ${Math.abs(dbDenda - calcDenda).toLocaleString('id-ID')}`);
            }
        } catch (error) {
            console.error("❌ Calculation error:", error);
        }
    }

    console.log("─".repeat(80));
    console.log("");
    console.log("SUMMARY:");
    console.log("─".repeat(80));
    
    const totalRows = result.rows.length;
    const totalDendaDb = result.rows.reduce((sum, row) => sum + parseInt(row.opname_nilai_denda || 0), 0);
    
    console.log(`Total Toko: ${totalRows}`);
    console.log(`Total Denda (DB): Rp ${totalDendaDb.toLocaleString('id-ID')}`);
    console.log("");
    
    if (totalDendaDb === 0) {
        console.log("✅ ALL CORRECT - No denda!");
    } else {
        console.log("⚠️  Still has denda - need backend restart/deploy");
    }

    console.log("");
    console.log("================================================================================");
}

checkRealtime()
    .then(() => {
        console.log("✅ Realtime check complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
