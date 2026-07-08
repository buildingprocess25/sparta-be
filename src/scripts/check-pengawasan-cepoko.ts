/**
 * Script to check berkas pengawasan for Cepoko
 */

import { pool } from "../db/pool";

async function checkPengawasan() {
    console.log("=".repeat(70));
    console.log("📋 CHECK BERKAS PENGAWASAN CEPOKO");
    console.log("=".repeat(70));
    console.log("");

    try {
        // Get all pengawasan data
        const result = await pool.query(`
            SELECT 
                p.id,
                p.id_gantt,
                p.kategori_pekerjaan,
                p.jenis_pekerjaan,
                p.status,
                p.created_at,
                pg.tanggal_pengawasan,
                TO_CHAR(p.created_at, 'YYYY-MM-DD HH24:MI:SS') AS pengawasan_created_datetime,
                t.nama_toko,
                t.nomor_ulok
            FROM pengawasan p
            LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            JOIN gantt_chart g ON g.id = p.id_gantt
            JOIN toko t ON t.id = g.id_toko
            WHERE (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
            ORDER BY 
                CASE 
                    WHEN pg.tanggal_pengawasan ~ '^\\d{2}/\\d{2}/\\d{4}$' 
                    THEN to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY')
                    ELSE NULL
                END DESC NULLS LAST,
                p.created_at DESC,
                p.id DESC
            LIMIT 20
        `);

        console.log(`Found ${result.rows.length} pengawasan records\n`);

        // Group by status
        const selesai = result.rows.filter(r => r.status === 'selesai');
        const lainnya = result.rows.filter(r => r.status !== 'selesai');

        console.log("✅ PENGAWASAN STATUS 'SELESAI'");
        console.log("-".repeat(70));
        
        if (selesai.length === 0) {
            console.log("(Tidak ada)\n");
        } else {
            selesai.forEach((row, idx) => {
                console.log(`${idx + 1}. ${row.kategori_pekerjaan} - ${row.jenis_pekerjaan}`);
                console.log(`   Status: ${row.status}`);
                console.log(`   Tanggal Pengawasan: ${row.tanggal_pengawasan}`);
                console.log(`   Created At: ${row.pengawasan_created_datetime}`);
                console.log("");
            });
        }

        console.log("📋 PENGAWASAN STATUS LAINNYA");
        console.log("-".repeat(70));
        
        if (lainnya.length === 0) {
            console.log("(Tidak ada)\n");
        } else {
            lainnya.slice(0, 5).forEach((row, idx) => {
                console.log(`${idx + 1}. ${row.kategori_pekerjaan} - ${row.jenis_pekerjaan}`);
                console.log(`   Status: ${row.status}`);
                console.log(`   Tanggal Pengawasan: ${row.tanggal_pengawasan}`);
                console.log(`   Created At: ${row.pengawasan_created_datetime}`);
                console.log("");
            });
            if (lainnya.length > 5) {
                console.log(`   ... dan ${lainnya.length - 5} lainnya\n`);
            }
        }

        // Get berkas pengawasan (PDF files)
        console.log("📄 BERKAS PENGAWASAN (PDF)");
        console.log("-".repeat(70));

        const berkasResult = await pool.query(`
            SELECT 
                bp.id,
                bp.link_pdf_pengawasan,
                bp.created_at,
                TO_CHAR(bp.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') AS created_datetime,
                DATE(bp.created_at AT TIME ZONE 'Asia/Jakarta') AS created_date,
                pg.id_pengawasan_gantt,
                t.nama_toko
            FROM berkas_pengawasan bp
            LEFT JOIN pengawasan_gantt pg ON pg.id = bp.id_pengawasan_gantt
            LEFT JOIN gantt_chart g ON g.id = pg.id_gantt
            LEFT JOIN toko t ON t.id = g.id_toko
            WHERE (UPPER(t.nama_toko) LIKE '%CEPOKO%BARU%' OR UPPER(t.nomor_ulok) LIKE '%CEPOKO%')
            ORDER BY bp.created_at DESC
            LIMIT 10
        `);

        if (berkasResult.rows.length === 0) {
            console.log("(Tidak ada berkas pengawasan)\n");
        } else {
            berkasResult.rows.forEach((row, idx) => {
                console.log(`${idx + 1}. Berkas Pengawasan ID: ${row.id}`);
                console.log(`   Created Date: ${row.created_date}`);
                console.log(`   Created DateTime: ${row.created_datetime}`);
                console.log(`   Link PDF: ${row.link_pdf_pengawasan ? 'Ada' : 'Tidak ada'}`);
                console.log("");
            });
        }

        // Check latest pengawasan date
        console.log("🔍 LATEST PENGAWASAN DATE");
        console.log("-".repeat(70));
        
        const latestPengawasan = result.rows.find(r => r.tanggal_pengawasan && r.tanggal_pengawasan !== '');
        
        if (latestPengawasan) {
            console.log(`Latest Tanggal Pengawasan: ${latestPengawasan.tanggal_pengawasan}`);
            console.log(`Kategori: ${latestPengawasan.kategori_pekerjaan} - ${latestPengawasan.jenis_pekerjaan}`);
            console.log(`Status: ${latestPengawasan.status}`);
            
            // Parse date
            if (latestPengawasan.tanggal_pengawasan.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const [day, month, year] = latestPengawasan.tanggal_pengawasan.split('/');
                const parsedDate = `${year}-${month}-${day}`;
                console.log(`Parsed Date: ${parsedDate}`);
                
                if (parsedDate === '2026-06-29') {
                    console.log("✅ CONFIRMED: Latest pengawasan date is 29 Juni 2026");
                    console.log("");
                    console.log("🔍 ANALYSIS:");
                    console.log("   - Pengawasan terakhir: 29 Juni");
                    console.log("   - Opname di-input: 30 Juni");
                    console.log("   - ST auto-generated: 30 Juni");
                    console.log("");
                    console.log("❓ QUESTION:");
                    console.log("   Kenapa opname baru di-input 30 Juni,");
                    console.log("   padahal pengawasan terakhir sudah 29 Juni?");
                    console.log("");
                    console.log("   Kemungkinan:");
                    console.log("   1. PIC baru input opname tanggal 30 (delay 1 hari)");
                    console.log("   2. Ada approval/review yang baru selesai tanggal 30");
                    console.log("   3. Kontraktor sebenarnya submit 29 malam, tapi sistem catat 30");
                }
            }
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

checkPengawasan()
    .then(() => {
        console.log("✅ Check completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Check failed:", error);
        process.exit(1);
    });
