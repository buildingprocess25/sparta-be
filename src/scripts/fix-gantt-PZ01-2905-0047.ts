/**
 * FIX SCRIPT: PZ01-2905-0047 - Perbaiki Gantt Chart Incomplete
 * 
 * Masalah: Gantt Chart hanya H29-H35 (7 hari), padahal durasi 35 hari
 * Solusi: 
 * 1. Tambah kategori "PEKERJAAN TAMBAHAN" yang hilang
 * 2. Update day items agar mulai dari H1-H35
 * 3. Generate 8 jadwal pengawasan untuk Non-Ruko
 */

import { pool } from '../db/pool';

async function fix() {
    console.log('\n='.repeat(80));
    console.log('FIX: PZ01-2905-0047 - Perbaiki Gantt Chart');
    console.log('='.repeat(80));

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const ganttId = 545;

        // 1. BEFORE STATE
        console.log('\n[1] BEFORE STATE:');
        console.log('-'.repeat(80));
        const beforeResult = await client.query(`
            SELECT 
                g.id,
                g.status,
                COUNT(DISTINCT kp.id) AS jumlah_kategori,
                COUNT(DISTINCT dg.id) AS jumlah_day_items,
                array_agg(DISTINCT kp.kategori_pekerjaan ORDER BY kp.kategori_pekerjaan) 
                    FILTER (WHERE kp.kategori_pekerjaan IS NOT NULL) AS kategori_list,
                MIN((dg.h_awal)::int) AS h_awal_min,
                MAX((dg.h_akhir)::int) AS h_akhir_max
            FROM gantt_chart g
            LEFT JOIN kategori_pekerjaan_gantt kp ON kp.id_gantt = g.id
            LEFT JOIN day_gantt_chart dg ON dg.id_gantt = g.id
            WHERE g.id = $1
            GROUP BY g.id, g.status
        `, [ganttId]);

        const before = beforeResult.rows[0];
        console.log(`  Gantt ID: ${before.id}`);
        console.log(`  Status: ${before.status}`);
        console.log(`  Jumlah Kategori: ${before.jumlah_kategori}`);
        console.log(`  Kategori: ${before.kategori_list?.join(', ')}`);
        console.log(`  Day Items: ${before.jumlah_day_items}`);
        console.log(`  Range: H${before.h_awal_min || '?'} - H${before.h_akhir_max || '?'}`);

        // 2. UNLOCK GANTT
        console.log('\n[2] UNLOCK GANTT CHART:');
        console.log('-'.repeat(80));
        await client.query(`
            UPDATE gantt_chart
            SET status = 'active'
            WHERE id = $1
        `, [ganttId]);
        console.log('  ✓ Gantt Chart di-unlock');

        // 3. TAMBAH KATEGORI "PEKERJAAN TAMBAHAN"
        console.log('\n[3] TAMBAH KATEGORI YANG HILANG:');
        console.log('-'.repeat(80));
        
        const checkKategori = await client.query(`
            SELECT id FROM kategori_pekerjaan_gantt
            WHERE id_gantt = $1 AND kategori_pekerjaan = 'PEKERJAAN TAMBAHAN'
        `, [ganttId]);

        let idKategoriPekerjaanTambahan: number;

        if (checkKategori.rows.length === 0) {
            const insertKategori = await client.query(`
                INSERT INTO kategori_pekerjaan_gantt (id_gantt, kategori_pekerjaan)
                VALUES ($1, 'PEKERJAAN TAMBAHAN')
                RETURNING id
            `, [ganttId]);
            idKategoriPekerjaanTambahan = insertKategori.rows[0].id;
            console.log(`  ✓ Kategori "PEKERJAAN TAMBAHAN" ditambahkan (ID: ${idKategoriPekerjaanTambahan})`);
        } else {
            idKategoriPekerjaanTambahan = checkKategori.rows[0].id;
            console.log(`  ℹ️  Kategori "PEKERJAAN TAMBAHAN" sudah ada (ID: ${idKategoriPekerjaanTambahan})`);
        }

        // 4. UPDATE DAY ITEMS YANG SUDAH ADA
        console.log('\n[4] UPDATE DAY ITEMS:');
        console.log('-'.repeat(80));

        // INSTALASI: H29-H35 → H1-H30
        const updateInstalas = await client.query(`
            UPDATE day_gantt_chart dg
            SET 
                h_awal = '1',
                h_akhir = '30'
            FROM kategori_pekerjaan_gantt kp
            WHERE dg.id_gantt = $1
              AND dg.id_kategori_pekerjaan_gantt = kp.id
              AND kp.kategori_pekerjaan = 'INSTALASI'
            RETURNING dg.id
        `, [ganttId]);
        console.log(`  ✓ INSTALASI: H29-H35 → H1-H30 (${updateInstalas.rows.length} row updated)`);

        // FIXTURE: H32-H35 → H25-H35
        const updateFixture = await client.query(`
            UPDATE day_gantt_chart dg
            SET 
                h_awal = '25',
                h_akhir = '35'
            FROM kategori_pekerjaan_gantt kp
            WHERE dg.id_gantt = $1
              AND dg.id_kategori_pekerjaan_gantt = kp.id
              AND kp.kategori_pekerjaan = 'FIXTURE'
            RETURNING dg.id
        `, [ganttId]);
        console.log(`  ✓ FIXTURE: H32-H35 → H25-H35 (${updateFixture.rows.length} row updated)`);

        // 5. TAMBAH DAY ITEM UNTUK "PEKERJAAN TAMBAHAN"
        console.log('\n[5] TAMBAH DAY ITEM BARU:');
        console.log('-'.repeat(80));

        const checkDayItem = await client.query(`
            SELECT id FROM day_gantt_chart
            WHERE id_gantt = $1 
              AND id_kategori_pekerjaan_gantt = $2
        `, [ganttId, idKategoriPekerjaanTambahan]);

        if (checkDayItem.rows.length === 0) {
            await client.query(`
                INSERT INTO day_gantt_chart (
                    id_gantt, 
                    id_kategori_pekerjaan_gantt, 
                    h_awal, 
                    h_akhir,
                    keterlambatan,
                    kecepatan
                ) VALUES ($1, $2, '1', '10', NULL, NULL)
            `, [ganttId, idKategoriPekerjaanTambahan]);
            console.log('  ✓ PEKERJAAN TAMBAHAN: H1-H10 ditambahkan');
        } else {
            console.log('  ℹ️  Day item PEKERJAAN TAMBAHAN sudah ada');
        }

        // 6. GENERATE 8 JADWAL PENGAWASAN
        console.log('\n[6] GENERATE JADWAL PENGAWASAN:');
        console.log('-'.repeat(80));

        const tanggalPengawasan = [
            '05/06/2026', // H1
            '09/06/2026', // H5
            '14/06/2026', // H10
            '19/06/2026', // H15
            '24/06/2026', // H20
            '29/06/2026', // H25
            '04/07/2026', // H30
            '09/07/2026'  // H35
        ];

        let insertedCount = 0;
        for (const tanggal of tanggalPengawasan) {
            const checkTanggal = await client.query(`
                SELECT id FROM pengawasan_gantt
                WHERE id_gantt = $1 AND tanggal_pengawasan = $2
            `, [ganttId, tanggal]);

            if (checkTanggal.rows.length === 0) {
                await client.query(`
                    INSERT INTO pengawasan_gantt (id_gantt, tanggal_pengawasan)
                    VALUES ($1, $2)
                `, [ganttId, tanggal]);
                insertedCount++;
            }
        }
        console.log(`  ✓ ${insertedCount} tanggal pengawasan ditambahkan (total: 8)`);

        // 7. LOCK KEMBALI GANTT
        console.log('\n[7] LOCK KEMBALI GANTT CHART:');
        console.log('-'.repeat(80));
        await client.query(`
            UPDATE gantt_chart
            SET status = 'terkunci'
            WHERE id = $1
        `, [ganttId]);
        console.log('  ✓ Gantt Chart di-lock kembali');

        // 8. AFTER STATE
        console.log('\n[8] AFTER STATE:');
        console.log('-'.repeat(80));
        const afterResult = await client.query(`
            SELECT 
                g.id,
                g.status,
                COUNT(DISTINCT kp.id) AS jumlah_kategori,
                COUNT(DISTINCT dg.id) AS jumlah_day_items,
                array_agg(DISTINCT kp.kategori_pekerjaan ORDER BY kp.kategori_pekerjaan) 
                    FILTER (WHERE kp.kategori_pekerjaan IS NOT NULL) AS kategori_list,
                MIN((dg.h_awal)::int) AS h_awal_min,
                MAX((dg.h_akhir)::int) AS h_akhir_max,
                COUNT(DISTINCT pg.id) AS jumlah_tanggal_pengawasan
            FROM gantt_chart g
            LEFT JOIN kategori_pekerjaan_gantt kp ON kp.id_gantt = g.id
            LEFT JOIN day_gantt_chart dg ON dg.id_gantt = g.id
            LEFT JOIN pengawasan_gantt pg ON pg.id_gantt = g.id
            WHERE g.id = $1
            GROUP BY g.id, g.status
        `, [ganttId]);

        const after = afterResult.rows[0];
        console.log(`  Gantt ID: ${after.id}`);
        console.log(`  Status: ${after.status}`);
        console.log(`  Jumlah Kategori: ${after.jumlah_kategori}`);
        console.log(`  Kategori: ${after.kategori_list?.join(', ')}`);
        console.log(`  Day Items: ${after.jumlah_day_items}`);
        console.log(`  Range: H${after.h_awal_min} - H${after.h_akhir_max}`);
        console.log(`  Jadwal Pengawasan: ${after.jumlah_tanggal_pengawasan} tanggal`);

        // 9. VERIFICATION
        console.log('\n[9] VERIFICATION:');
        console.log('-'.repeat(80));
        
        const checks = [];
        const jumlahKategori = parseInt(after.jumlah_kategori);
        const jumlahDayItems = parseInt(after.jumlah_day_items);
        const jumlahTanggal = parseInt(after.jumlah_tanggal_pengawasan);

        if (jumlahKategori === 3) checks.push('✓ Kategori = 3 (correct)');
        else checks.push(`✗ Kategori = ${jumlahKategori} (expected: 3)`);

        if (jumlahDayItems === 3) checks.push('✓ Day Items = 3 (correct)');
        else checks.push(`✗ Day Items = ${jumlahDayItems} (expected: 3)`);

        if (after.h_awal_min === 1) checks.push('✓ H-awal = 1 (correct)');
        else checks.push(`✗ H-awal = ${after.h_awal_min} (expected: 1)`);

        if (after.h_akhir_max === 35) checks.push('✓ H-akhir = 35 (correct)');
        else checks.push(`✗ H-akhir = ${after.h_akhir_max} (expected: 35)`);

        if (jumlahTanggal === 8) checks.push('✓ Jadwal Pengawasan = 8 (correct)');
        else checks.push(`✗ Jadwal Pengawasan = ${jumlahTanggal} (expected: 8)`);

        checks.forEach(check => console.log(`  ${check}`));

        const allPass = checks.every(c => c.startsWith('✓'));

        if (allPass) {
            console.log('\n✅ ALL CHECKS PASSED! Commit changes...');
            await client.query('COMMIT');
            console.log('✅ FIX COMPLETED SUCCESSFULLY!');
        } else {
            console.log('\n❌ SOME CHECKS FAILED! Rolling back...');
            await client.query('ROLLBACK');
            console.log('❌ Changes rolled back.');
        }

        // 10. NEXT STEPS
        console.log('\n' + '='.repeat(80));
        console.log('NEXT STEPS:');
        console.log('='.repeat(80));
        console.log('1. Refresh halaman Gantt Chart untuk ULOK PZ01-2905-0047');
        console.log('2. Verifikasi Gantt Chart menampilkan H1-H35 (35 hari)');
        console.log('3. Verifikasi ada 3 kategori pekerjaan');
        console.log('4. Akses halaman PIC Pengawasan');
        console.log('5. Pilih 8 hari pengawasan');
        console.log('6. Submit PIC Pengawasan');
        console.log('='.repeat(80));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fix();
