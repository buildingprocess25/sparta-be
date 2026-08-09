import { pool } from './src/db/pool';

async function fixILDays() {
    const client = await pool.connect();
    let totalFixed = 0;

    console.log('\n' + '='.repeat(80));
    console.log('MIGRASI JADWAL HARI UNTUK KATEGORI IL YANG GAIB (TIDAK ADA BALOK)');
    console.log('='.repeat(80));

    try {
        await client.query('BEGIN');

        // Cari kategori IL yang tidak punya jadwal ATAU h_awal-nya NULL
        const missingDaysRes = await client.query(`
            SELECT 
                t.nomor_ulok, 
                t.lingkup_pekerjaan, 
                g.id AS gantt_id, 
                kpg.id AS id_kpg, 
                kpg.kategori_pekerjaan,
                dgc.id AS dgc_id,
                dgc.h_awal
            FROM toko t
            JOIN gantt_chart g ON g.id_toko = t.id
            JOIN kategori_pekerjaan_gantt kpg ON kpg.id_gantt = g.id
            LEFT JOIN day_gantt_chart dgc ON dgc.id_kategori_pekerjaan_gantt = kpg.id
            WHERE kpg.kategori_pekerjaan ILIKE '%[IL]%'
              AND (dgc.id IS NULL OR dgc.h_awal IS NULL OR TRIM(dgc.h_awal) = '')
            ORDER BY t.nomor_ulok, t.lingkup_pekerjaan;
        `);

        if (missingDaysRes.rows.length === 0) {
            console.log('✅ Tidak ditemukan item IL yang kehilangan jadwal hari.');
            await client.query('ROLLBACK');
            return;
        }

        console.log(`\n🔍 Ditemukan ${missingDaysRes.rows.length} item IL yang kehilangan jadwal hari (atau h_awal NULL/kosong).`);

        for (const row of missingDaysRes.rows) {
            const rangeRes = await client.query(`
                SELECT 
                    COALESCE(MAX(NULLIF(TRIM(h_akhir), '')::int), 30) AS max_akhir,
                    COALESCE(MIN(NULLIF(TRIM(h_awal), '')::int), 1) AS min_awal
                FROM day_gantt_chart
                WHERE id_gantt = $1
            `, [row.gantt_id]);

            const hAwal = rangeRes.rows[0]?.min_awal ?? 1;
            const hAkhir = rangeRes.rows[0]?.max_akhir ?? 30;

            console.log(`   🛠️ Fixing ULOK ${row.nomor_ulok} [${row.lingkup_pekerjaan}]`);
            console.log(`      ↳ Injecting hari ${hAwal} s/d ${hAkhir} untuk kategori: ${row.kategori_pekerjaan}`);

            if (row.dgc_id) {
                // Update jika barisnya ada tapi isinya kosong
                await client.query(`
                    UPDATE day_gantt_chart 
                    SET h_awal = $1, h_akhir = $2 
                    WHERE id = $3
                `, [String(hAwal), String(hAkhir), row.dgc_id]);
            } else {
                // Insert jika tidak ada sama sekali
                await client.query(`
                    INSERT INTO day_gantt_chart 
                    (id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan)
                    VALUES ($1, $2, $3, $4, NULL, NULL)
                `, [row.gantt_id, row.id_kpg, String(hAwal), String(hAkhir)]);
            }

            totalFixed++;
        }

        await client.query('COMMIT');
        console.log('\n' + '='.repeat(80));
        console.log(`✅ BERHASIL! Total ${totalFixed} item IL telah diberikan jadwal (balok).`);
        console.log('='.repeat(80));

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ GAGAL! Perubahan dibatalkan (rollback). Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

fixILDays().catch(console.error);
