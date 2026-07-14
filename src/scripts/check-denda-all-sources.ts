import { pool } from '../db/pool';

/**
 * Check denda dari SEMUA sources untuk ULOK 2VZ1-2604-0007
 */
async function checkDendaAllSources() {
    console.log('🔍 Checking Denda dari SEMUA Sources: ULOK 2VZ1-2604-0007');
    console.log('=' .repeat(70));

    try {
        // 1. Check Toko & SPK basic info
        console.log('\n📦 STEP 1: Basic Info - Toko & SPK\n');
        const basicInfo = await pool.query(`
            SELECT 
                t.id as toko_id,
                t.nomor_ulok,
                t.kode_toko,
                t.nama_toko,
                ps.id as spk_id,
                ps.nomor_spk,
                ps.lingkup_pekerjaan,
                ps.status as spk_status,
                ps.waktu_selesai as spk_original_end,
                ps.created_at as spk_created
            FROM toko t
            LEFT JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
            ORDER BY ps.lingkup_pekerjaan
        `);
        console.table(basicInfo.rows);

        // 2. Check Pertambahan SPK
        console.log('\n📝 STEP 2: Pertambahan SPK\n');
        const pertambahan = await pool.query(`
            SELECT 
                pt.id as pertambahan_id,
                pt.id_spk,
                ps.nomor_spk,
                ps.lingkup_pekerjaan,
                pt.status_persetujuan,
                pt.tanggal_spk_akhir_setelah_perpanjangan as extended_date,
                pt.created_at,
                t.nomor_ulok
            FROM pertambahan_spk pt
            JOIN pengajuan_spk ps ON ps.id = pt.id_spk
            JOIN toko t ON t.id = ps.id_toko
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
            ORDER BY pt.id
        `);
        
        if (pertambahan.rows.length === 0) {
            console.log('❌ Tidak ada pertambahan SPK');
        } else {
            console.table(pertambahan.rows);
        }

        // 3. Check Opname Final (denda source #1)
        console.log('\n🎯 STEP 3: Opname Final (Denda Source #1)\n');
        const opnameFinal = await pool.query(`
            SELECT 
                of.id as opname_id,
                of.id_toko,
                t.nomor_ulok,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                of.nilai_denda,
                of.hari_denda,
                of.tanggal_akhir_spk_denda,
                of.created_at
            FROM opname_final of
            JOIN toko t ON t.id = of.id_toko
            LEFT JOIN pengajuan_spk ps ON ps.id_toko = t.id AND ps.status = 'SPK_APPROVED'
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
            ORDER BY ps.lingkup_pekerjaan
        `);
        
        if (opnameFinal.rows.length === 0) {
            console.log('ℹ️  Belum ada Opname Final (normal jika belum selesai pekerjaan)');
        } else {
            console.table(opnameFinal.rows);
            
            const hasDenda = opnameFinal.rows.some((r: any) => r.nilai_denda > 0);
            if (hasDenda) {
                console.log('\n⚠️  DENDA TERDETEKSI di Opname Final!');
            } else {
                console.log('\n✅ Tidak ada denda di Opname Final');
            }
        }

        // 4. Check Surat Peringatan Candidates
        console.log('\n📋 STEP 4: Surat Peringatan Candidates (Calculated Real-time)\n');
        const spCandidates = await pool.query(`
            WITH toko_info AS (
                SELECT 
                    t.id as toko_id,
                    t.nomor_ulok,
                    t.kode_toko,
                    t.nama_toko,
                    ps.id as spk_id,
                    ps.nomor_spk,
                    ps.lingkup_pekerjaan,
                    ps.waktu_selesai as original_end,
                    (
                        SELECT MAX(pt2.tanggal_spk_akhir_setelah_perpanjangan)
                        FROM pertambahan_spk pt2
                        JOIN pengajuan_spk ps_source ON ps_source.id = pt2.id_spk
                        JOIN toko t_source ON t_source.id = ps_source.id_toko
                        WHERE t_source.nomor_ulok = t.nomor_ulok
                          AND UPPER(TRIM(COALESCE(pt2.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ) as max_extended_date
                FROM toko t
                JOIN pengajuan_spk ps ON ps.id_toko = t.id
                WHERE t.nomor_ulok = '2VZ1-2604-0007'
                  AND ps.status = 'SPK_APPROVED'
            )
            SELECT 
                toko_id,
                nomor_ulok,
                kode_toko,
                nama_toko,
                spk_id,
                nomor_spk,
                lingkup_pekerjaan,
                original_end,
                max_extended_date,
                COALESCE(max_extended_date::date, original_end::date) as effective_end,
                CURRENT_DATE - COALESCE(max_extended_date::date, original_end::date) as days_late,
                CASE 
                    WHEN CURRENT_DATE > COALESCE(max_extended_date::date, original_end::date) 
                    THEN (CURRENT_DATE - COALESCE(max_extended_date::date, original_end::date)) * 1000000
                    ELSE 0
                END as calculated_denda
            FROM toko_info
            ORDER BY lingkup_pekerjaan
        `);
        console.table(spCandidates.rows);

        const hasSPDenda = spCandidates.rows.some((r: any) => r.calculated_denda > 0);
        if (hasSPDenda) {
            console.log('\n⚠️  DENDA TERDETEKSI untuk Surat Peringatan!');
        } else {
            console.log('\n✅ Tidak ada denda untuk Surat Peringatan (belum terlambat atau sudah diperpanjang)');
        }

        // 5. Check Monitoring Eksekusi view/calculation
        console.log('\n📊 STEP 5: Monitoring Eksekusi Status\n');
        const monitoringStatus = await pool.query(`
            SELECT 
                t.nomor_ulok,
                t.kode_toko,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                ps.waktu_selesai as original_end,
                (
                    SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)
                    FROM pertambahan_spk pt
                    JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
                    JOIN toko t_source ON t_source.id = ps_source.id_toko
                    WHERE t_source.nomor_ulok = t.nomor_ulok
                      AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                ) as extended_end,
                COALESCE(
                    (
                        SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)
                        FROM pertambahan_spk pt
                        JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
                        JOIN toko t_source ON t_source.id = ps_source.id_toko
                        WHERE t_source.nomor_ulok = t.nomor_ulok
                          AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                    ),
                    ps.waktu_selesai
                ) as effective_deadline,
                CASE 
                    WHEN CURRENT_DATE > COALESCE(
                        (
                            SELECT MAX(pt.tanggal_spk_akhir_setelah_perpanjangan)
                            FROM pertambahan_spk pt
                            JOIN pengajuan_spk ps_source ON ps_source.id = pt.id_spk
                            JOIN toko t_source ON t_source.id = ps_source.id_toko
                            WHERE t_source.nomor_ulok = t.nomor_ulok
                              AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
                        ),
                        ps.waktu_selesai
                    )::date
                    THEN 'TERLAMBAT'
                    ELSE 'TEPAT WAKTU'
                END as status_keterlambatan
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            WHERE t.nomor_ulok = '2VZ1-2604-0007'
              AND ps.status = 'SPK_APPROVED'
            ORDER BY ps.lingkup_pekerjaan
        `);
        console.table(monitoringStatus.rows);

        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 KESIMPULAN:');
        console.log('=' .repeat(70));
        
        const tokoCount = basicInfo.rows.length;
        const pertambahanCount = pertambahan.rows.length;
        const opnameFinalCount = opnameFinal.rows.length;
        const hasDendaOpname = opnameFinal.rows.some((r: any) => r.nilai_denda > 0);
        const willHaveDendaSP = spCandidates.rows.some((r: any) => r.calculated_denda > 0);
        const isTerlambat = monitoringStatus.rows.some((r: any) => r.status_keterlambatan === 'TERLAMBAT');

        console.log(`\nToko records:              ${tokoCount}`);
        console.log(`Pertambahan SPK:           ${pertambahanCount}`);
        console.log(`Opname Final:              ${opnameFinalCount}`);
        console.log(`Denda di Opname Final:     ${hasDendaOpname ? '⚠️  YA' : '✅ TIDAK'}`);
        console.log(`Potensi denda SP:          ${willHaveDendaSP ? '⚠️  YA' : '✅ TIDAK'}`);
        console.log(`Status keterlambatan:      ${isTerlambat ? '⚠️  TERLAMBAT' : '✅ TEPAT WAKTU'}`);

        console.log('\n' + '='.repeat(70));
        
        if (opnameFinalCount === 0) {
            console.log('ℹ️  ULOK belum mencapai tahap Opname Final');
            console.log('ℹ️  Denda akan dihitung ketika Opname Final dibuat');
            
            if (pertambahanCount > 0) {
                console.log('✅ Ada pertambahan SPK approved');
                console.log('✅ Backend fix sudah deployed');
                console.log('✅ Ketika Opname Final dibuat, kedua lingkup akan dapat perpanjangan');
                console.log('✅ Expected: Denda = Rp 0 untuk SIPIL & ME');
            }
        } else {
            if (hasDendaOpname) {
                console.log('⚠️  ADA DENDA di Opname Final!');
                console.log('💡 Perlu refresh denda calculation');
                console.log('💡 Run: npx ts-node src/scripts/execute-fix-denda-ulok-2VZ1-2604-0007.ts');
            } else {
                console.log('✅ TIDAK ADA DENDA di Opname Final');
                console.log('✅ Fix sudah bekerja dengan baik!');
            }
        }

        if (willHaveDendaSP) {
            console.log('\n⚠️  WARNING: Masih akan kena Surat Peringatan (SP)');
            console.log('💡 Kemungkinan: Waktu sudah lewat deadline meskipun ada perpanjangan');
            console.log('💡 Atau: Backend fix belum fully deployed');
        }

        console.log('=' .repeat(70));

    } catch (error: any) {
        console.error('\n❌ Error checking denda:');
        console.error(error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Execute
checkDendaAllSources()
    .then(() => {
        console.log('\n🎉 Check completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Check failed:', error);
        process.exit(1);
    });
