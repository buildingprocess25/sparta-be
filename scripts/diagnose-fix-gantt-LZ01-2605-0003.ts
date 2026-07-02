/**
 * Script untuk diagnosa dan fix bug Gantt Chart kosong
 * ULOK: LZ01-2605-0003
 * 
 * Usage:
 *   npx tsx scripts/diagnose-fix-gantt-LZ01-2605-0003.ts --diagnose
 *   npx tsx scripts/diagnose-fix-gantt-LZ01-2605-0003.ts --fix
 */

import { pool } from '../src/db/pool';

const ULOK = 'LZ01-2605-0003';

interface TokoRow {
    id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    nama_toko: string;
    cabang: string;
}

interface GanttRow {
    gantt_id: number;
    status: string;
    timestamp: string;
    day_count: string;
    kategori_count: string;
}

interface RabRow {
    id: number;
    status: string;
    lingkup_pekerjaan: string;
}

async function diagnose() {
    console.log('\n========================================');
    console.log(`🔍 DIAGNOSIS: Gantt Chart Bug - ${ULOK}`);
    console.log('========================================\n');

    try {
        // 1. Cek data toko
        console.log('1️⃣  CHECKING TOKO DATA...\n');
        const tokoRes = await pool.query<TokoRow>(`
            SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko, cabang 
            FROM toko 
            WHERE nomor_ulok = $1
            ORDER BY id
        `, [ULOK]);

        if (tokoRes.rows.length === 0) {
            console.log('❌ ERROR: Toko tidak ditemukan di database!\n');
            console.log('   ACTION: Pastikan data toko sudah ada di database.');
            console.log('   Kemungkinan ULOK typo atau belum di-input.\n');
            return { hasIssue: true, scenario: 'TOKO_NOT_FOUND' };
        }

        console.log(`✅ Found ${tokoRes.rows.length} toko record(s):\n`);
        tokoRes.rows.forEach(row => {
            console.log(`   - ID: ${row.id}`);
            console.log(`     ULOK: ${row.nomor_ulok}`);
            console.log(`     Lingkup: ${row.lingkup_pekerjaan}`);
            console.log(`     Nama: ${row.nama_toko}`);
            console.log(`     Cabang: ${row.cabang}\n`);
        });

        // 2. Cek Gantt Chart untuk setiap toko
        console.log('2️⃣  CHECKING GANTT CHART DATA...\n');
        
        const problems: Array<{ toko: TokoRow; issue: string; gantt?: GanttRow }> = [];

        for (const toko of tokoRes.rows) {
            const ganttRes = await pool.query<GanttRow>(`
                SELECT 
                    g.id as gantt_id, 
                    g.status, 
                    g.timestamp,
                    (SELECT COUNT(*) FROM day_gantt_chart WHERE id_gantt = g.id) as day_count,
                    (SELECT COUNT(*) FROM kategori_pekerjaan_gantt WHERE id_gantt = g.id) as kategori_count
                FROM gantt_chart g
                WHERE g.id_toko = $1
                ORDER BY g.id DESC
            `, [toko.id]);

            console.log(`   📋 ${toko.lingkup_pekerjaan} (Toko ID: ${toko.id}):`);

            if (ganttRes.rows.length === 0) {
                console.log(`      ❌ NO GANTT CHART FOUND!\n`);
                problems.push({ 
                    toko, 
                    issue: 'NO_GANTT' 
                });
            } else {
                const gantt = ganttRes.rows[0];
                console.log(`      ✅ Gantt ID: ${gantt.gantt_id}`);
                console.log(`         Status: ${gantt.status}`);
                console.log(`         Timestamp: ${gantt.timestamp}`);
                console.log(`         Kategori Count: ${gantt.kategori_count}`);
                console.log(`         Day Items Count: ${gantt.day_count}\n`);

                if (Number(gantt.day_count) === 0) {
                    console.log(`      ⚠️  WARNING: Gantt Chart CORRUPT (no day items)!\n`);
                    problems.push({ 
                        toko, 
                        issue: 'CORRUPT_GANTT',
                        gantt 
                    });
                }
            }
        }

        // 3. Cek status RAB
        console.log('3️⃣  CHECKING RAB STATUS...\n');

        for (const toko of tokoRes.rows) {
            const rabRes = await pool.query<RabRow>(`
                SELECT r.id, r.status, t.lingkup_pekerjaan
                FROM rab r
                JOIN toko t ON t.id = r.id_toko
                WHERE r.id_toko = $1
                ORDER BY r.id DESC
                LIMIT 1
            `, [toko.id]);

            if (rabRes.rows.length > 0) {
                const rab = rabRes.rows[0];
                console.log(`   📄 ${toko.lingkup_pekerjaan} (Toko ID: ${toko.id}):`);
                console.log(`      RAB ID: ${rab.id}`);
                console.log(`      Status: ${rab.status}\n`);

                if (rab.status === 'Menunggu Gantt Chart') {
                    console.log(`      ⚠️  RAB is waiting for Gantt Chart!\n`);
                }
            } else {
                console.log(`   📄 ${toko.lingkup_pekerjaan} (Toko ID: ${toko.id}):`);
                console.log(`      ❌ NO RAB FOUND\n`);
            }
        }

        // 4. Summary & Recommendations
        console.log('\n========================================');
        console.log('📊 DIAGNOSIS SUMMARY');
        console.log('========================================\n');

        if (problems.length === 0) {
            console.log('✅ No issues detected with Gantt Chart data.\n');
            console.log('   Possible causes:');
            console.log('   - Frontend bug (query with wrong id_toko)');
            console.log('   - Caching issue (try clear browser cache)');
            console.log('   - Permission issue (user role)');
            return { hasIssue: false, scenario: 'NO_BACKEND_ISSUE' };
        }

        console.log(`⚠️  Found ${problems.length} issue(s):\n`);

        for (const problem of problems) {
            console.log(`   🔸 ${problem.toko.lingkup_pekerjaan} (ID: ${problem.toko.id}):`);
            
            if (problem.issue === 'NO_GANTT') {
                console.log(`      Issue: Gantt Chart belum dibuat`);
                console.log(`      Solution: Kontraktor harus buat Gantt Chart baru`);
                console.log(`      Command: --fix-create ${problem.toko.id}\n`);
            } else if (problem.issue === 'CORRUPT_GANTT') {
                console.log(`      Issue: Gantt Chart corrupt (ada record tapi no day items)`);
                console.log(`      Solution: Delete corrupt gantt & buat ulang`);
                console.log(`      Command: --fix-repair ${problem.gantt?.gantt_id}\n`);
            }
        }

        return { hasIssue: true, problems };

    } catch (error) {
        console.error('\n❌ ERROR during diagnosis:', error);
        throw error;
    }
}

async function fixCreateNew(tokoId: number) {
    console.log('\n========================================');
    console.log(`🔧 FIX: Create New Gantt Chart Workflow`);
    console.log('========================================\n');

    try {
        // Cek toko exists
        const tokoRes = await pool.query<TokoRow>(`
            SELECT id, nomor_ulok, lingkup_pekerjaan, nama_toko 
            FROM toko 
            WHERE id = $1
        `, [tokoId]);

        if (tokoRes.rows.length === 0) {
            console.log('❌ Toko not found!\n');
            return;
        }

        const toko = tokoRes.rows[0];
        console.log(`Toko: ${toko.nama_toko}`);
        console.log(`ULOK: ${toko.nomor_ulok}`);
        console.log(`Lingkup: ${toko.lingkup_pekerjaan}\n`);

        // Cek RAB status
        const rabRes = await pool.query(`
            SELECT id, status 
            FROM rab 
            WHERE id_toko = $1 
            ORDER BY id DESC 
            LIMIT 1
        `, [tokoId]);

        if (rabRes.rows.length === 0) {
            console.log('❌ RAB not found for this toko.\n');
            console.log('   ACTION: Buat RAB terlebih dahulu sebelum Gantt Chart.\n');
            return;
        }

        const rab = rabRes.rows[0];
        console.log(`RAB Status: ${rab.status}\n`);

        // Guide user
        console.log('📝 ACTION REQUIRED:\n');
        console.log('Gantt Chart harus dibuat melalui UI oleh Kontraktor.\n');
        console.log('Langkah-langkah:');
        console.log('1. Login sebagai Kontraktor');
        console.log('2. Akses menu "Gantt Chart"');
        console.log(`3. Pilih project dengan ULOK: ${toko.nomor_ulok}`);
        console.log('4. Input kategori pekerjaan & jadwal');
        console.log('5. Submit Gantt Chart\n');

        console.log('Atau gunakan API:');
        console.log(`POST /api/gantt/submit`);
        console.log('{\n');
        console.log(`  "nomor_ulok": "${toko.nomor_ulok}",`);
        console.log(`  "lingkup_pekerjaan": "${toko.lingkup_pekerjaan}",`);
        console.log('  "email_pembuat": "kontraktor@example.com",');
        console.log('  "kategori_pekerjaan": ["PEKERJAAN PERSIAPAN", "..."],');
        console.log('  "day_items": [');
        console.log('    { "kategori_pekerjaan": "PEKERJAAN PERSIAPAN", "h_awal": "1", "h_akhir": "3" },');
        console.log('    ...');
        console.log('  ]');
        console.log('}\n');

    } catch (error) {
        console.error('❌ ERROR:', error);
        throw error;
    }
}

async function fixRepairCorrupt(ganttId: number) {
    console.log('\n========================================');
    console.log(`🔧 FIX: Repair Corrupt Gantt Chart`);
    console.log('========================================\n');

    try {
        // Cek gantt exists
        const ganttRes = await pool.query(`
            SELECT g.id, g.id_toko, g.status, t.nomor_ulok, t.lingkup_pekerjaan
            FROM gantt_chart g
            JOIN toko t ON t.id = g.id_toko
            WHERE g.id = $1
        `, [ganttId]);

        if (ganttRes.rows.length === 0) {
            console.log('❌ Gantt Chart not found!\n');
            return;
        }

        const gantt = ganttRes.rows[0];
        console.log(`Gantt ID: ${gantt.id}`);
        console.log(`ULOK: ${gantt.nomor_ulok}`);
        console.log(`Lingkup: ${gantt.lingkup_pekerjaan}`);
        console.log(`Status: ${gantt.status}\n`);

        // Confirm delete
        console.log('⚠️  WARNING: This will DELETE the corrupt Gantt Chart.\n');
        console.log('Langkah repair:');
        console.log('1. Backup database (CRITICAL!)');
        console.log('2. Delete corrupt gantt_chart record');
        console.log('3. Update RAB status ke "Menunggu Gantt Chart"');
        console.log('4. Minta Kontraktor buat Gantt Chart baru\n');

        console.log('SQL Commands:\n');
        console.log('-- BACKUP FIRST!');
        console.log('BEGIN;');
        console.log(`DELETE FROM gantt_chart WHERE id = ${gantt.id};`);
        console.log(`UPDATE rab SET status = 'Menunggu Gantt Chart' WHERE id_toko = ${gantt.id_toko};`);
        console.log('COMMIT;\n');

        console.log('⚠️  Execute manually with caution!\n');

    } catch (error) {
        console.error('❌ ERROR:', error);
        throw error;
    }
}

// Main
(async () => {
    const args = process.argv.slice(2);

    try {
        if (args.includes('--diagnose')) {
            await diagnose();
        } else if (args[0] === '--fix-create' && args[1]) {
            await fixCreateNew(Number(args[1]));
        } else if (args[0] === '--fix-repair' && args[1]) {
            await fixRepairCorrupt(Number(args[1]));
        } else {
            console.log('\nUsage:');
            console.log('  npx tsx scripts/diagnose-fix-gantt-LZ01-2605-0003.ts --diagnose');
            console.log('  npx tsx scripts/diagnose-fix-gantt-LZ01-2605-0003.ts --fix-create <toko_id>');
            console.log('  npx tsx scripts/diagnose-fix-gantt-LZ01-2605-0003.ts --fix-repair <gantt_id>\n');
        }
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
