/**
 * DIAGNOSIS SCRIPT: PZ01-2905-0047 - Gantt Chart Incomplete
 * 
 * Issue: Durasi SPK 35 hari, tapi Gantt Chart hanya tampil 7 tanggal
 * Expected: Gantt Chart lengkap dengan 35 hari dan semua kategori pekerjaan
 */

import { pool } from '../db/pool';

async function diagnose() {
    console.log('\n='.repeat(80));
    console.log('DIAGNOSIS: PZ01-2905-0047 - Gantt Chart Incomplete');
    console.log('='.repeat(80));

    const ulok = 'PZ01-2905-0047';
    const lingkup = 'ME';

    try {
        // 1. CEK DATA TOKO
        console.log('\n[1] DATA TOKO:');
        console.log('-'.repeat(80));
        const tokoResult = await pool.query(`
            SELECT 
                t.id,
                t.nomor_ulok,
                t.lingkup_pekerjaan,
                t.nama_toko,
                t.kode_toko,
                t.cabang,
                t.proyek
            FROM toko t
            WHERE t.nomor_ulok = $1 AND t.lingkup_pekerjaan = $2
        `, [ulok, lingkup]);

        if (tokoResult.rows.length === 0) {
            console.log('❌ TOKO TIDAK DITEMUKAN!');
            return;
        }

        const toko = tokoResult.rows[0];
        console.log('✓ Toko ditemukan:');
        console.log(`  ID: ${toko.id}`);
        console.log(`  ULOK: ${toko.nomor_ulok}`);
        console.log(`  Lingkup: ${toko.lingkup_pekerjaan}`);
        console.log(`  Nama: ${toko.nama_toko}`);
        console.log(`  Cabang: ${toko.cabang}`);
        console.log(`  Proyek: ${toko.proyek}`);

        const idToko = toko.id;

        // 2. CEK DATA RAB
        console.log('\n[2] DATA RAB:');
        console.log('-'.repeat(80));
        const rabResult = await pool.query(`
            SELECT 
                r.id,
                r.status,
                r.kategori_lokasi,
                r.durasi_pekerjaan,
                r.grand_total_final,
                r.email_pembuat,
                r.created_at,
                COUNT(ri.id) AS jumlah_rab_items
            FROM rab r
            LEFT JOIN rab_item ri ON ri.id_rab = r.id
            WHERE r.id_toko = $1
            GROUP BY r.id, r.status, r.kategori_lokasi, r.durasi_pekerjaan, 
                     r.grand_total_final, r.email_pembuat, r.created_at
            ORDER BY r.id DESC
            LIMIT 1
        `, [idToko]);

        if (rabResult.rows.length === 0) {
            console.log('❌ RAB TIDAK DITEMUKAN!');
            return;
        }

        const rab = rabResult.rows[0];
        console.log('✓ RAB ditemukan:');
        console.log(`  ID RAB: ${rab.id}`);
        console.log(`  Status: ${rab.status}`);
        console.log(`  Kategori Lokasi: ${rab.kategori_lokasi}`);
        console.log(`  Durasi Pekerjaan: ${rab.durasi_pekerjaan}`);
        console.log(`  Grand Total: ${rab.grand_total_final}`);
        console.log(`  Jumlah RAB Items: ${rab.jumlah_rab_items}`);
        console.log(`  Pembuat: ${rab.email_pembuat}`);

        // 3. CEK KATEGORI PEKERJAAN DARI RAB
        console.log('\n[3] KATEGORI PEKERJAAN (dari RAB):');
        console.log('-'.repeat(80));
        const kategoriRabResult = await pool.query(`
            SELECT 
                DISTINCT ri.kategori_pekerjaan,
                COUNT(ri.id) AS jumlah_items
            FROM rab_item ri
            WHERE ri.id_rab = $1
            GROUP BY ri.kategori_pekerjaan
            ORDER BY ri.kategori_pekerjaan
        `, [rab.id]);

        console.log(`  Total kategori pekerjaan di RAB: ${kategoriRabResult.rows.length}`);
        kategoriRabResult.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.kategori_pekerjaan} (${row.jumlah_items} items)`);
        });

        // 4. CEK DATA SPK
        console.log('\n[4] DATA SPK:');
        console.log('-'.repeat(80));
        const spkResult = await pool.query(`
            SELECT 
                s.id,
                s.nomor_spk,
                s.status,
                s.waktu_mulai,
                s.waktu_selesai,
                s.durasi,
                s.grand_total,
                s.email_pembuat
            FROM pengajuan_spk s
            WHERE s.id_toko = $1
            ORDER BY s.id DESC
            LIMIT 1
        `, [idToko]);

        if (spkResult.rows.length === 0) {
            console.log('❌ SPK TIDAK DITEMUKAN!');
        } else {
            const spk = spkResult.rows[0];
            console.log('✓ SPK ditemukan:');
            console.log(`  ID SPK: ${spk.id}`);
            console.log(`  Nomor SPK: ${spk.nomor_spk || '-'}`);
            console.log(`  Status: ${spk.status}`);
            console.log(`  Waktu Mulai: ${spk.waktu_mulai}`);
            console.log(`  Waktu Selesai: ${spk.waktu_selesai}`);
            console.log(`  Durasi: ${spk.durasi} hari`);
            console.log(`  Grand Total: ${spk.grand_total}`);
        }

        // 5. CEK GANTT CHART
        console.log('\n[5] DATA GANTT CHART:');
        console.log('-'.repeat(80));
        const ganttResult = await pool.query(`
            SELECT 
                g.id,
                g.status,
                g.email_pembuat,
                g.timestamp,
                COUNT(DISTINCT kp.id) AS jumlah_kategori,
                COUNT(DISTINCT dg.id) AS jumlah_day_items
            FROM gantt_chart g
            LEFT JOIN kategori_pekerjaan_gantt kp ON kp.id_gantt = g.id
            LEFT JOIN day_gantt_chart dg ON dg.id_gantt = g.id
            WHERE g.id_toko = $1
            GROUP BY g.id, g.status, g.email_pembuat, g.timestamp
            ORDER BY g.id DESC
            LIMIT 1
        `, [idToko]);

        if (ganttResult.rows.length === 0) {
            console.log('❌ GANTT CHART TIDAK DITEMUKAN!');
            console.log('   PENYEBAB MASALAH: Gantt Chart belum dibuat oleh kontraktor!');
            return;
        }

        const gantt = ganttResult.rows[0];
        console.log('✓ Gantt Chart ditemukan:');
        console.log(`  ID Gantt: ${gantt.id}`);
        console.log(`  Status: ${gantt.status}`);
        console.log(`  Timestamp: ${gantt.timestamp}`);
        console.log(`  Jumlah Kategori: ${gantt.jumlah_kategori}`);
        console.log(`  Jumlah Day Items: ${gantt.jumlah_day_items}`);

        // 6. CEK KATEGORI PEKERJAAN DI GANTT
        console.log('\n[6] KATEGORI PEKERJAAN (di Gantt Chart):');
        console.log('-'.repeat(80));
        const kategoriGanttResult = await pool.query(`
            SELECT 
                kp.id,
                kp.kategori_pekerjaan
            FROM kategori_pekerjaan_gantt kp
            WHERE kp.id_gantt = $1
            ORDER BY kp.id
        `, [gantt.id]);

        console.log(`  Total kategori di Gantt: ${kategoriGanttResult.rows.length}`);
        if (kategoriGanttResult.rows.length > 0) {
            kategoriGanttResult.rows.forEach((row, idx) => {
                console.log(`  ${idx + 1}. ${row.kategori_pekerjaan}`);
            });
        } else {
            console.log('  ❌ TIDAK ADA KATEGORI PEKERJAAN DI GANTT!');
        }

        // 7. CEK DAY ITEMS DI GANTT
        console.log('\n[7] DAY ITEMS (di Gantt Chart):');
        console.log('-'.repeat(80));
        const dayItemsResult = await pool.query(`
            SELECT 
                dg.id,
                kp.kategori_pekerjaan,
                dg.h_awal,
                dg.h_akhir,
                dg.keterlambatan,
                dg.kecepatan
            FROM day_gantt_chart dg
            JOIN kategori_pekerjaan_gantt kp ON kp.id = dg.id_kategori_pekerjaan_gantt
            WHERE dg.id_gantt = $1
            ORDER BY dg.h_awal::int, dg.id
        `, [gantt.id]);

        console.log(`  Total day items: ${dayItemsResult.rows.length}`);
        if (dayItemsResult.rows.length > 0) {
            dayItemsResult.rows.forEach((row, idx) => {
                console.log(`  ${idx + 1}. ${row.kategori_pekerjaan}: H${row.h_awal} - H${row.h_akhir}`);
            });

            // Hitung H-akhir maksimum
            const maxHAkhir = Math.max(...dayItemsResult.rows.map(r => parseInt(r.h_akhir || '0')));
            console.log(`\n  ⚠️  H-akhir maksimum: H${maxHAkhir}`);
            console.log(`  ⚠️  Durasi SPK: ${spkResult.rows[0]?.durasi || '?'} hari`);
            
            if (maxHAkhir < (spkResult.rows[0]?.durasi || 0)) {
                console.log(`  ❌ MASALAH: Gantt Chart TIDAK LENGKAP!`);
                console.log(`     Day items hanya sampai H${maxHAkhir}, padahal durasi ${spkResult.rows[0]?.durasi} hari`);
            }
        } else {
            console.log('  ❌ TIDAK ADA DAY ITEMS DI GANTT!');
        }

        // 8. CEK JADWAL PENGAWASAN
        console.log('\n[8] JADWAL PENGAWASAN:');
        console.log('-'.repeat(80));
        const pengawasanGanttResult = await pool.query(`
            SELECT 
                pg.id,
                pg.tanggal_pengawasan,
                pg.id_pic_pengawasan,
                COUNT(p.id) AS jumlah_pengawasan_items
            FROM pengawasan_gantt pg
            LEFT JOIN pengawasan p ON p.id_pengawasan_gantt = pg.id
            WHERE pg.id_gantt = $1
            GROUP BY pg.id, pg.tanggal_pengawasan, pg.id_pic_pengawasan
            ORDER BY 
                CASE 
                    WHEN pg.tanggal_pengawasan ~ '^\\d{2}/\\d{2}/\\d{4}$' 
                    THEN to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY')
                    ELSE NULL
                END ASC NULLS LAST
        `, [gantt.id]);

        console.log(`  Total tanggal pengawasan: ${pengawasanGanttResult.rows.length}`);
        if (pengawasanGanttResult.rows.length > 0) {
            pengawasanGanttResult.rows.forEach((row, idx) => {
                console.log(`  ${idx + 1}. ${row.tanggal_pengawasan} (${row.jumlah_pengawasan_items} items terisi)`);
            });
        } else {
            console.log('  ℹ️  Belum ada jadwal pengawasan (normal jika PIC belum dibuat)');
        }

        // 9. CEK PIC PENGAWASAN
        console.log('\n[9] PIC PENGAWASAN:');
        console.log('-'.repeat(80));
        const picResult = await pool.query(`
            SELECT 
                pic.id,
                pic.kategori_lokasi,
                pic.durasi,
                pic.tanggal_mulai_spk,
                pic.plc_building_support,
                pic.created_at
            FROM pic_pengawasan pic
            WHERE pic.id_toko = $1
        `, [idToko]);

        if (picResult.rows.length === 0) {
            console.log('  ℹ️  PIC Pengawasan belum dibuat (normal untuk ULOK baru)');
        } else {
            const pic = picResult.rows[0];
            console.log('✓ PIC Pengawasan ditemukan:');
            console.log(`  ID PIC: ${pic.id}`);
            console.log(`  Kategori Lokasi: ${pic.kategori_lokasi}`);
            console.log(`  Durasi: ${pic.durasi}`);
            console.log(`  Tanggal Mulai: ${pic.tanggal_mulai_spk}`);
            console.log(`  PIC: ${pic.plc_building_support}`);
        }

        // 10. KESIMPULAN
        console.log('\n' + '='.repeat(80));
        console.log('KESIMPULAN & REKOMENDASI:');
        console.log('='.repeat(80));

        const issues = [];
        
        if (kategoriGanttResult.rows.length < 5) {
            issues.push(`❌ Gantt Chart hanya punya ${kategoriGanttResult.rows.length} kategori (seharusnya lebih banyak)`);
        }

        if (dayItemsResult.rows.length < 5) {
            issues.push(`❌ Day items hanya ${dayItemsResult.rows.length} (sangat sedikit untuk durasi 35 hari)`);
        }

        const maxH = dayItemsResult.rows.length > 0 
            ? Math.max(...dayItemsResult.rows.map(r => parseInt(r.h_akhir || '0')))
            : 0;
        
        if (maxH < (spkResult.rows[0]?.durasi || 0)) {
            issues.push(`❌ Gantt Chart hanya sampai H${maxH}, padahal durasi ${spkResult.rows[0]?.durasi} hari`);
        }

        if (kategoriRabResult.rows.length > kategoriGanttResult.rows.length) {
            issues.push(`❌ RAB punya ${kategoriRabResult.rows.length} kategori, tapi Gantt hanya ${kategoriGanttResult.rows.length}`);
        }

        if (issues.length > 0) {
            console.log('\n🔴 MASALAH DITEMUKAN:');
            issues.forEach((issue, idx) => {
                console.log(`${idx + 1}. ${issue}`);
            });

            console.log('\n💡 SOLUSI:');
            console.log('1. Kontraktor harus BUAT ULANG Gantt Chart yang lengkap');
            console.log('2. Gantt Chart harus mencakup SEMUA kategori pekerjaan dari RAB');
            console.log('3. Day items harus sampai H35 (sesuai durasi SPK)');
            console.log('4. Setelah Gantt Chart lengkap, baru bisa input PIC Pengawasan');
            console.log('\n📌 Cara Buat Gantt Chart:');
            console.log('   - Login sebagai Kontraktor');
            console.log('   - Menu "Gantt Chart" → Pilih ULOK PZ01-2905-0047');
            console.log('   - Input semua kategori pekerjaan dari RAB');
            console.log('   - Set jadwal (H-awal, H-akhir) untuk setiap kategori');
            console.log('   - Pastikan H-akhir terakhir = H35');
            console.log('   - Submit Gantt Chart');
        } else {
            console.log('\n✅ Data lengkap! Tidak ada masalah ditemukan.');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error);
    } finally {
        await pool.end();
    }
}

diagnose();
