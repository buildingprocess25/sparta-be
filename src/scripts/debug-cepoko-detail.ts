/**
 * Script to debug Cepoko case in detail
 * Check SPK, Gantt, Opname, and ST timestamps
 */

import { pool } from "../db/pool";

async function debugCepoko() {
    console.log("=".repeat(70));
    console.log("🔍 DEBUG CEPOKO - Detailed Analysis");
    console.log("=".repeat(70));
    console.log("");

    try {
        const result = await pool.query(`
            SELECT 
                t.id AS toko_id,
                t.nomor_ulok,
                t.nama_toko,
                t.lingkup_pekerjaan,
                t.cabang,
                
                -- SPK Info
                ps.waktu_mulai AS spk_start_date,
                ps.waktu_selesai AS spk_end_date,
                ps.durasi AS spk_duration,
                DATE(ps.waktu_selesai) AS spk_end_date_only,
                
                -- Gantt Chart
                MAX(NULLIF(regexp_replace(dgc.h_akhir, '[^0-9]', '', 'g'), '')::int) AS gantt_last_day,
                MAX(pg.tanggal_pengawasan) AS last_pengawasan_date,
                
                -- Opname Final
                ofn.id AS opname_final_id,
                ofn.created_at AS opname_created_at_full,
                DATE(ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS opname_date,
                TO_CHAR(ofn.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') AS opname_datetime,
                EXTRACT(HOUR FROM ofn.created_at AT TIME ZONE 'Asia/Jakarta') AS opname_hour,
                
                -- Serah Terima
                bst.id AS berkas_st_id,
                bst.created_at AS st_created_at_full,
                DATE(bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_date,
                TO_CHAR(bst.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') AS st_datetime,
                EXTRACT(HOUR FROM bst.created_at AT TIME ZONE 'Asia/Jakarta') AS st_hour,
                
                -- Denda
                ofn.hari_denda AS current_hari_denda,
                ofn.nilai_denda AS current_nilai_denda,
                ofn.tanggal_akhir_spk_denda,
                ofn.tanggal_serah_terima_denda,
                
                -- Time difference
                EXTRACT(EPOCH FROM (bst.created_at - ofn.created_at)) AS seconds_between_opname_and_st
                
            FROM toko t
            LEFT JOIN pengajuan_spk ps ON ps.id_toko = t.id
            LEFT JOIN gantt_chart gc ON gc.id_toko = t.id
            LEFT JOIN day_gantt_chart dgc ON dgc.id_gantt = gc.id
            LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = gc.id
            LEFT JOIN opname_final ofn ON ofn.id_toko = t.id
            LEFT JOIN berkas_serah_terima bst ON bst.id_toko = t.id
            
            WHERE UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%'
               OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%'
            
            GROUP BY 
                t.id, t.nomor_ulok, t.nama_toko, t.lingkup_pekerjaan, t.cabang,
                ps.waktu_mulai, ps.waktu_selesai, ps.durasi,
                ofn.id, ofn.created_at, ofn.hari_denda, ofn.nilai_denda,
                ofn.tanggal_akhir_spk_denda, ofn.tanggal_serah_terima_denda,
                bst.id, bst.created_at
        `);

        if (result.rows.length === 0) {
            console.log("❌ Toko Cepoko tidak ditemukan!");
            process.exit(1);
        }

        const row = result.rows[0];

        console.log("📋 BASIC INFO");
        console.log("-".repeat(70));
        console.log(`Toko ID         : ${row.toko_id}`);
        console.log(`ULOK            : ${row.nomor_ulok}`);
        console.log(`Nama Toko       : ${row.nama_toko}`);
        console.log(`Lingkup         : ${row.lingkup_pekerjaan}`);
        console.log(`Cabang          : ${row.cabang}`);
        console.log("");

        console.log("📅 SPK DATES");
        console.log("-".repeat(70));
        console.log(`Start Date      : ${row.spk_start_date}`);
        console.log(`End Date        : ${row.spk_end_date_only} (${row.spk_end_date})`);
        console.log(`Duration        : ${row.spk_duration} hari`);
        console.log("");

        console.log("📊 GANTT CHART");
        console.log("-".repeat(70));
        console.log(`Last Day (h_akhir)       : Hari ke-${row.gantt_last_day}`);
        console.log(`Last Pengawasan Date     : ${row.last_pengawasan_date}`);
        console.log("");

        console.log("📦 OPNAME FINAL");
        console.log("-".repeat(70));
        console.log(`Opname ID       : ${row.opname_final_id}`);
        console.log(`Created At      : ${row.opname_datetime}`);
        console.log(`Date Only       : ${row.opname_date}`);
        console.log(`Hour            : ${row.opname_hour}:xx (${row.opname_hour >= 23 ? '⚠️ Late night!' : 'Normal'})`);
        console.log("");

        console.log("📄 SERAH TERIMA");
        console.log("-".repeat(70));
        console.log(`Berkas ST ID    : ${row.berkas_st_id}`);
        console.log(`Created At      : ${row.st_datetime}`);
        console.log(`Date Only       : ${row.st_date}`);
        console.log(`Hour            : ${row.st_hour}:xx (${row.st_hour < 1 ? '⚠️ After midnight!' : 'Normal'})`);
        console.log(`Time Gap        : ${Math.round(row.seconds_between_opname_and_st)} seconds (${Math.round(row.seconds_between_opname_and_st / 60)} minutes)`);
        console.log("");

        console.log("💰 DENDA INFO");
        console.log("-".repeat(70));
        console.log(`Hari Denda      : ${row.current_hari_denda} hari`);
        console.log(`Nilai Denda     : Rp ${row.current_nilai_denda}`);
        console.log(`SPK End (Denda) : ${row.tanggal_akhir_spk_denda}`);
        console.log(`ST Date (Denda) : ${row.tanggal_serah_terima_denda}`);
        console.log("");

        console.log("🔍 ANALYSIS");
        console.log("-".repeat(70));

        // Calculate expected free date
        const spkEndDate = new Date(row.spk_end_date_only);
        const dayOfWeek = spkEndDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        let freeDate = new Date(spkEndDate);
        freeDate.setDate(freeDate.getDate() + 1);
        
        // Skip weekend
        while (freeDate.getDay() === 0 || freeDate.getDay() === 6) {
            freeDate.setDate(freeDate.getDate() + 1);
        }
        
        const freeDateStr = freeDate.toISOString().split('T')[0];
        
        console.log(`SPK End Date    : ${row.spk_end_date_only} (${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dayOfWeek]})`);
        console.log(`Free Date       : ${freeDateStr} (hari bebas denda)`);
        console.log(`ST Date         : ${row.st_date}`);
        console.log("");

        if (row.st_date === freeDateStr) {
            console.log("✅ ST di free date → SEHARUSNYA TIDAK KENA DENDA");
        } else if (row.st_date < freeDateStr) {
            console.log("✅ ST sebelum free date → SEHARUSNYA TIDAK KENA DENDA");
        } else {
            console.log(`❌ ST setelah free date → KENA DENDA ${row.current_hari_denda} hari`);
        }
        console.log("");

        // Check if Gantt last day matches SPK
        if (row.gantt_last_day) {
            const ganttEndDate = new Date(row.spk_start_date);
            ganttEndDate.setDate(ganttEndDate.getDate() + row.gantt_last_day - 1);
            const ganttEndDateStr = ganttEndDate.toISOString().split('T')[0];
            
            console.log("🔄 GANTT VS SPK");
            console.log(`Gantt Last Day  : Hari ke-${row.gantt_last_day} → ${ganttEndDateStr}`);
            console.log(`SPK End Date    : ${row.spk_end_date_only}`);
            
            if (ganttEndDateStr !== row.spk_end_date_only) {
                console.log(`⚠️  MISMATCH! Gantt end date (${ganttEndDateStr}) ≠ SPK end date (${row.spk_end_date_only})`);
                console.log(`    Sistem perhitungan denda pakai SPK end date, bukan Gantt!`);
            } else {
                console.log(`✅ MATCH! Gantt dan SPK sync`);
            }
        }
        console.log("");

        console.log("📌 ROOT CAUSE");
        console.log("-".repeat(70));
        
        if (row.opname_hour >= 23) {
            console.log("⚠️  Opname dibuat jam 23:xx (malam)");
            console.log("    Kemungkinan kontraktor submit malam, tapi sistem catat hari ini (30 Juni)");
        }
        
        if (row.st_hour < 1) {
            console.log("⚠️  ST dibuat jam 00:xx (setelah tengah malam)");
            console.log("    Background job delay melewati tengah malam");
        }

        if (row.spk_end_date_only === '2026-06-27') {
            console.log("✅ SPK end: 27 Juni (Sabtu)");
            console.log("   Free date: 29 Juni (Senin) - skip weekend");
            console.log("   ST actual: 30 Juni");
            console.log("   → Denda 1 hari BENAR dari SPK perspective");
            console.log("");
            console.log("❓ TAPI jika Gantt Chart terakhir adalah 29 Juni,");
            console.log("   maka seharusnya SPK end juga 29 Juni, bukan 27 Juni!");
        }

        console.log("");
        console.log("=".repeat(70));

    } catch (error) {
        console.error("❌ Error:", error);
        throw error;
    } finally {
        await pool.end();
    }
}

debugCepoko()
    .then(() => {
        console.log("✅ Debug completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Debug failed:", error);
        process.exit(1);
    });
