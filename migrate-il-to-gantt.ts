/**
 * MIGRATE-IL-TO-GANTT
 * ===================
 * Script ini memigrasi item Instruksi Lapangan (IL) yang kategorinya
 * TIDAK terdaftar di kategori_pekerjaan_gantt karena gantt sudah terkunci
 * saat IL dibuat.
 *
 * Masalah:
 *   - IL dibuat → gantt sudah 'terkunci'
 *   - Kategori IL tidak masuk ke kategori_pekerjaan_gantt
 *   - Pengawasan IL sudah diisi (hijau di UI) dengan prefix [IL]
 *   - total_expected_items tidak menghitung IL tsb → totalSelesai != totalExpected
 *   - FE memblok generate Serah Terima
 *
 * Solusi: Tambahkan kategori IL yang hilang ke kategori_pekerjaan_gantt
 *         lalu tambahkan day_gantt_chart entry yang sesuai.
 *
 * Target ULOK: 2SZ1-2601-0010 dan UZ01-2606-UF70-R
 *
 * Jalankan: npx ts-node migrate-il-to-gantt.ts
 * DRY RUN dulu: set DRY_RUN=true (default) lalu set DRY_RUN=false untuk apply
 */

import { pool } from './src/db/pool';

// ============================================================
// KONFIGURASI
// ============================================================
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: DRY RUN

// Target ULOK yang bermasalah - tambahkan/hapus sesuai kebutuhan
const TARGET_ULOK: string[] = [
    '2SZ1-2601-0010',
    'UZ01-2606-UF70-R',
];
// ============================================================

interface DiagnoseResult {
    nomor_ulok: string;
    id_toko: number;
    lingkup_pekerjaan: string | null;
    gantt_id: number | null;
    gantt_status: string | null;
    il_kategori_missing: MissingILKategori[];
    total_selesai: number;
    total_expected_current: number;
    total_expected_after_fix: number;
}

interface MissingILKategori {
    id_instruksi_lapangan: number;
    il_status: string;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    item_count: number;
    has_pengawasan: boolean;
    pengawasan_status: string | null;
}

async function diagnose(client: any, nomorUlok: string): Promise<DiagnoseResult[]> {
    const tokoRes = await client.query(`
        SELECT 
            t.id,
            t.nomor_ulok,
            t.lingkup_pekerjaan,
            g.id AS gantt_id,
            g.status AS gantt_status
        FROM toko t
        LEFT JOIN LATERAL (
            SELECT id, status FROM gantt_chart
            WHERE id_toko = t.id
            ORDER BY id DESC LIMIT 1
        ) g ON true
        WHERE t.nomor_ulok = $1
        ORDER BY t.id
    `, [nomorUlok]);

    const results: DiagnoseResult[] = [];

    for (const toko of tokoRes.rows) {
        if (!toko.gantt_id) {
            console.log(`  ⚠️  Toko id=${toko.id} (${toko.lingkup_pekerjaan}) tidak punya gantt chart, skip.`);
            continue;
        }

        // Ambil kategori yang sudah ada di gantt
        const kategoriGanttRes = await client.query(`
            SELECT UPPER(TRIM(kategori_pekerjaan)) AS kategori
            FROM kategori_pekerjaan_gantt
            WHERE id_gantt = $1
        `, [toko.gantt_id]);
        const kategoriGanttSet = new Set(kategoriGanttRes.rows.map((r: any) => r.kategori));

        // Ambil semua IL Disetujui untuk toko ini beserta kategori item-nya
        const ilRes = await client.query(`
            SELECT 
                il.id AS id_instruksi_lapangan,
                il.status AS il_status,
                UPPER(TRIM(ili.kategori_pekerjaan)) AS kategori_pekerjaan,
                UPPER(TRIM(ili.jenis_pekerjaan)) AS jenis_pekerjaan,
                COUNT(ili.id)::int AS item_count
            FROM instruksi_lapangan il
            JOIN instruksi_lapangan_item ili ON ili.id_instruksi_lapangan = il.id
            WHERE il.id_toko = $1
              AND UPPER(il.status) IN ('DISETUJUI', 'APPROVED')
            GROUP BY il.id, il.status, UPPER(TRIM(ili.kategori_pekerjaan)), UPPER(TRIM(ili.jenis_pekerjaan))
            ORDER BY il.id, kategori_pekerjaan
        `, [toko.id]);

        // Filter: hanya yang belum ada di kategori_pekerjaan_gantt
        const missingKategori: MissingILKategori[] = [];
        for (const il of ilRes.rows) {
            if (!kategoriGanttSet.has(il.kategori_pekerjaan)) {
                // Cek apakah ada pengawasan dengan prefix [IL] untuk kategori ini
                const pengawasanRes = await client.query(`
                    SELECT p.status
                    FROM pengawasan p
                    WHERE p.id_gantt = $1
                      AND UPPER(TRIM(REPLACE(COALESCE(p.kategori_pekerjaan, ''), '[IL] ', ''))) = $2
                    ORDER BY p.id DESC
                    LIMIT 1
                `, [toko.gantt_id, il.kategori_pekerjaan]);

                missingKategori.push({
                    id_instruksi_lapangan: il.id_instruksi_lapangan,
                    il_status: il.il_status,
                    kategori_pekerjaan: il.kategori_pekerjaan,
                    jenis_pekerjaan: il.jenis_pekerjaan,
                    item_count: il.item_count,
                    has_pengawasan: pengawasanRes.rows.length > 0,
                    pengawasan_status: pengawasanRes.rows[0]?.status ?? null,
                });
            }
        }

        // Hitung total_selesai saat ini
        const selesaiRes = await client.query(`
            SELECT COUNT(*)::int AS cnt
            FROM (
                SELECT DISTINCT ON (
                    UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                    UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
                )
                    p.status
                FROM pengawasan p
                LEFT JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
                WHERE p.id_gantt = $1
                ORDER BY
                    UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                    UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                    to_date(pg.tanggal_pengawasan, 'DD/MM/YYYY') DESC NULLS LAST,
                    p.id DESC
            ) latest
            WHERE LOWER(status) = 'selesai'
        `, [toko.gantt_id]);

        // Hitung total_expected saat ini (RAB + IL yang sudah ada di kategori gantt)
        const expectedCurrentRes = await client.query(`
            SELECT COUNT(*)::int AS cnt
            FROM (
                SELECT ri.id
                FROM rab_item ri
                JOIN rab r ON r.id = ri.id_rab
                WHERE r.id_toko = $1
                  AND UPPER(TRIM(COALESCE(ri.kategori_pekerjaan, ''))) IN (
                      SELECT UPPER(TRIM(kpg.kategori_pekerjaan))
                      FROM kategori_pekerjaan_gantt kpg
                      WHERE kpg.id_gantt = $2
                  )
                UNION ALL
                SELECT ili.id
                FROM instruksi_lapangan_item ili
                JOIN instruksi_lapangan il ON il.id = ili.id_instruksi_lapangan
                WHERE il.id_toko = $1
                  AND UPPER(TRIM(COALESCE(ili.kategori_pekerjaan, ''))) IN (
                      SELECT UPPER(TRIM(kpg.kategori_pekerjaan))
                      FROM kategori_pekerjaan_gantt kpg
                      WHERE kpg.id_gantt = $2
                  )
            ) expected_items
        `, [toko.id, toko.gantt_id]);

        const ilMissingCount = missingKategori.reduce((sum, k) => sum + k.item_count, 0);

        results.push({
            nomor_ulok: toko.nomor_ulok,
            id_toko: toko.id,
            lingkup_pekerjaan: toko.lingkup_pekerjaan,
            gantt_id: toko.gantt_id,
            gantt_status: toko.gantt_status,
            il_kategori_missing: missingKategori,
            total_selesai: selesaiRes.rows[0]?.cnt ?? 0,
            total_expected_current: expectedCurrentRes.rows[0]?.cnt ?? 0,
            total_expected_after_fix: (expectedCurrentRes.rows[0]?.cnt ?? 0) + ilMissingCount,
        });
    }

    return results;
}

async function applyFix(client: any, result: DiagnoseResult): Promise<{
    kategori_added: string[];
    day_items_added: number;
}> {
    const kategoriAdded: string[] = [];
    let dayItemsAdded = 0;

    // Ambil range hari dari gantt (pakai max h_akhir yang ada)
    const hRes = await client.query(`
        SELECT 
            COALESCE(MAX(h_akhir::int), 30) AS h_akhir_max,
            COALESCE(MIN(h_awal::int), 1) AS h_awal_min
        FROM day_gantt_chart
        WHERE id_gantt = $1
    `, [result.gantt_id]);

    const hAwal = hRes.rows[0]?.h_awal_min ?? 1;
    const hAkhir = hRes.rows[0]?.h_akhir_max ?? 30;

    // Unique kategori dari IL yang hilang
    const uniqueKategori = [...new Set(result.il_kategori_missing.map(k => k.kategori_pekerjaan))];

    for (const kategori of uniqueKategori) {
        const existsRes = await client.query(`
            SELECT id FROM kategori_pekerjaan_gantt
            WHERE id_gantt = $1
              AND UPPER(TRIM(kategori_pekerjaan)) = UPPER(TRIM($2))
        `, [result.gantt_id, kategori]);

        if (existsRes.rows.length > 0) {
            console.log(`    ℹ️  Kategori "${kategori}" sudah ada di gantt, skip.`);
            continue;
        }

        // Insert kategori baru ke kategori_pekerjaan_gantt
        const insertKategoriRes = await client.query(`
            INSERT INTO kategori_pekerjaan_gantt (id_gantt, kategori_pekerjaan)
            VALUES ($1, $2)
            RETURNING id
        `, [result.gantt_id, kategori]);

        const idKategori = insertKategoriRes.rows[0].id;
        kategoriAdded.push(kategori);
        console.log(`    ✅ Kategori "${kategori}" ditambahkan ke kategori_pekerjaan_gantt (id: ${idKategori})`);

        // Tambahkan day_gantt_chart entry untuk kategori baru ini
        await client.query(`
            INSERT INTO day_gantt_chart (id_gantt, id_kategori_pekerjaan_gantt, h_awal, h_akhir, keterlambatan, kecepatan)
            VALUES ($1, $2, $3, $4, NULL, NULL)
        `, [result.gantt_id, idKategori, String(hAwal), String(hAkhir)]);

        dayItemsAdded++;
        console.log(`    ✅ Day item H${hAwal}-H${hAkhir} ditambahkan untuk "${kategori}"`);
    }

    return { kategori_added: kategoriAdded, day_items_added: dayItemsAdded };
}

async function run() {
    console.log('\n' + '='.repeat(80));
    console.log('MIGRATE IL TO GANTT CHART - KATEGORI_PEKERJAAN_GANTT');
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (tidak ada perubahan)' : '🚀 APPLY (perubahan akan disimpan)'}`);
    console.log(`Target ULOK: ${TARGET_ULOK.join(', ')}`);
    console.log('='.repeat(80));

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let totalKategoriAdded = 0;
        let totalDayItemsAdded = 0;
        let totalUlokFixed = 0;

        for (const ulok of TARGET_ULOK) {
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`📍 ULOK: ${ulok}`);
            console.log('─'.repeat(60));

            const diagnoseResults = await diagnose(client, ulok);

            if (diagnoseResults.length === 0) {
                console.log('  ⚠️  Tidak ada toko ditemukan untuk ULOK ini.');
                continue;
            }

            for (const result of diagnoseResults) {
                console.log(`\n  [Toko id=${result.id_toko}, ${result.lingkup_pekerjaan ?? 'N/A'}]`);
                console.log(`  Gantt ID: ${result.gantt_id} (status: ${result.gantt_status})`);
                console.log(`  total_selesai:           ${result.total_selesai}`);
                console.log(`  total_expected (skrg):   ${result.total_expected_current}`);
                console.log(`  total_expected (setelah): ${result.total_expected_after_fix}`);

                if (result.il_kategori_missing.length === 0) {
                    console.log(`  ✅ Tidak ada IL kategori yang hilang dari gantt.`);
                    if (result.total_selesai !== result.total_expected_current) {
                        console.log(`  ⚠️  Masih ada mismatch (${result.total_selesai} vs ${result.total_expected_current})`);
                        console.log(`  💡 Bukan karena IL. Cek: nama kategori typo, pertambahan SPK belum di-sync.`);
                    }
                    continue;
                }

                console.log(`\n  📋 IL Kategori yang hilang dari gantt (${result.il_kategori_missing.length} entry):`);
                for (const k of result.il_kategori_missing) {
                    const pgInfo = k.has_pengawasan
                        ? `pengawasan ada (status: ${k.pengawasan_status})`
                        : `belum ada pengawasan`;
                    console.log(`    - [IL #${k.id_instruksi_lapangan}] ${k.kategori_pekerjaan} → ${k.item_count} item | ${pgInfo}`);
                }

                if (DRY_RUN) {
                    console.log(`\n  🔍 [DRY RUN] Akan menambahkan ${[...new Set(result.il_kategori_missing.map(k=>k.kategori_pekerjaan))].length} kategori ke gantt.`);
                    continue;
                }

                console.log(`\n  🔧 Menerapkan fix...`);
                const fixResult = await applyFix(client, result);
                totalKategoriAdded += fixResult.kategori_added.length;
                totalDayItemsAdded += fixResult.day_items_added;
                if (fixResult.kategori_added.length > 0) totalUlokFixed++;
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('RINGKASAN');
        console.log('='.repeat(80));

        if (DRY_RUN) {
            console.log('🔍 DRY RUN selesai. Tidak ada perubahan yang disimpan.');
            console.log('   Untuk apply: DRY_RUN=false npx ts-node migrate-il-to-gantt.ts');
            await client.query('ROLLBACK');
        } else {
            console.log(`✅ Total ULOK yang di-fix: ${totalUlokFixed}`);
            console.log(`✅ Total kategori ditambahkan: ${totalKategoriAdded}`);
            console.log(`✅ Total day items ditambahkan: ${totalDayItemsAdded}`);
            await client.query('COMMIT');
            console.log('\n✅ Semua perubahan berhasil di-commit ke database.');
            console.log('\n📌 Langkah selanjutnya:');
            console.log('   1. Refresh halaman Gantt Chart untuk ULOK yang di-fix');
            console.log('   2. Verifikasi tombol "Generate Serah Terima" sudah aktif');
            console.log('   3. Jika masih bermasalah, cek log BE untuk detail error readiness');
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR, semua perubahan di-rollback:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
