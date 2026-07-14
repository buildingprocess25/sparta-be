import { pool } from '../db/pool';

/**
 * Find all ULOKs in production that have:
 * - Multiple lingkup (SIPIL + ME)
 * - Pertambahan SPK approved
 * - Opname Final with denda > 0
 */
async function findAffectedUloks() {
    console.log('🔍 Finding ULOKs with Denda + Pertambahan SPK in Production');
    console.log('=' .repeat(70));

    try {
        console.log('\n📊 Searching for affected ULOKs...\n');
        
        const result = await pool.query(`
            WITH ulok_with_multiple_lingkup AS (
                SELECT nomor_ulok
                FROM toko
                GROUP BY nomor_ulok
                HAVING COUNT(*) > 1
            ),
            ulok_with_pertambahan AS (
                SELECT DISTINCT t.nomor_ulok
                FROM pertambahan_spk pt
                JOIN pengajuan_spk ps ON ps.id = pt.id_spk
                JOIN toko t ON t.id = ps.id_toko
                WHERE UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
            ),
            ulok_with_denda AS (
                SELECT DISTINCT t.nomor_ulok
                FROM opname_final of
                JOIN toko t ON t.id = of.id_toko
                WHERE of.nilai_denda > 0
            )
            SELECT DISTINCT
                t.nomor_ulok,
                t.kode_toko,
                t.nama_toko,
                ps.lingkup_pekerjaan,
                ps.nomor_spk,
                ps.waktu_selesai as spk_original_end,
                pt.tanggal_spk_akhir_setelah_perpanjangan as extended_end,
                of.nilai_denda,
                of.hari_denda,
                of.tanggal_akhir_spk_denda,
                CASE 
                    WHEN of.tanggal_akhir_spk_denda::date < pt.tanggal_spk_akhir_setelah_perpanjangan::date 
                    THEN '❌ NEEDS FIX'
                    ELSE '✅ OK'
                END as status
            FROM toko t
            JOIN pengajuan_spk ps ON ps.id_toko = t.id
            JOIN opname_final of ON of.id_toko = t.id
            LEFT JOIN pertambahan_spk pt ON pt.id_spk = ps.id
            WHERE t.nomor_ulok IN (SELECT nomor_ulok FROM ulok_with_multiple_lingkup)
              AND t.nomor_ulok IN (SELECT nomor_ulok FROM ulok_with_pertambahan)
              AND t.nomor_ulok IN (SELECT nomor_ulok FROM ulok_with_denda)
              AND ps.status = 'SPK_APPROVED'
              AND UPPER(TRIM(COALESCE(pt.status_persetujuan, ''))) IN ('APPROVED', 'DISETUJUI', 'DISETUJUI BM')
            ORDER BY 
                t.nomor_ulok,
                ps.lingkup_pekerjaan
        `);

        if (result.rows.length === 0) {
            console.log('✅ No ULOKs found with this issue in production!');
            console.log('ℹ️  Either:');
            console.log('   1. The fix has already been applied');
            console.log('   2. No ULOKs have reached opname_final stage yet');
            console.log('   3. The issue only exists in staging/local environment');
        } else {
            console.log(`⚠️  Found ${result.rows.length} record(s) that need fixing:\n`);
            console.table(result.rows);

            // Group by ULOK
            const ulokGroups = result.rows.reduce((acc: any, row: any) => {
                if (!acc[row.nomor_ulok]) {
                    acc[row.nomor_ulok] = [];
                }
                acc[row.nomor_ulok].push(row);
                return acc;
            }, {});

            console.log('\n📋 Affected ULOKs by group:\n');
            Object.entries(ulokGroups).forEach(([ulok, records]: [string, any]) => {
                console.log(`\n🔸 ULOK: ${ulok}`);
                console.log(`   Store: ${records[0].nama_toko} (${records[0].kode_toko})`);
                console.log(`   Lingkup count: ${records.length}`);
                
                records.forEach((rec: any) => {
                    console.log(`   - ${rec.lingkup_pekerjaan}: Denda Rp ${rec.nilai_denda?.toLocaleString('id-ID')} (${rec.hari_denda} days)`);
                });
            });

            console.log('\n\n💡 To fix these ULOKs, run:');
            console.log('   npx ts-node src/scripts/fix-all-affected-uloks.ts');
        }

        console.log('\n' + '='.repeat(70));
        console.log('📊 SUMMARY:');
        console.log('=' .repeat(70));
        console.log(`Total records with issue: ${result.rows.length}`);
        console.log(`Unique ULOKs affected:     ${new Set(result.rows.map((r: any) => r.nomor_ulok)).size}`);
        console.log('=' .repeat(70));

    } catch (error: any) {
        console.error('\n❌ Error searching for affected ULOKs:');
        console.error(error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Execute
findAffectedUloks()
    .then(() => {
        console.log('\n🎉 Search completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Search failed:', error);
        process.exit(1);
    });
