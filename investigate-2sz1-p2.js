const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function investigatePart2() {
    console.log('=== BAGIAN 2: DUPLIKAT, TANGGAL PENGAWASAN, SPK INFO ===\n');

    // 1. Cek duplikat (alias ambiguous id fix)
    const dupRes = await pool.query(`
        SELECT 
            UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))) as cat,
            UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))) as jenis,
            COUNT(p.id) as total_records,
            STRING_AGG(p.status, ', ' ORDER BY p.id DESC) as all_statuses
        FROM pengawasan p
        JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
        WHERE pg.id_gantt = 548
        GROUP BY 
            UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
            UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
        HAVING COUNT(p.id) > 1
        ORDER BY COUNT(p.id) DESC
        LIMIT 20
    `);
    
    console.log(`=== ITEM DENGAN LEBIH DARI 1 RECORD (cek duplikat) ===`);
    console.log(`Total unique item yang punya multiple records: ${dupRes.rows.length}`);
    for (const dup of dupRes.rows.slice(0, 10)) {
        console.log(`  [${dup.total_records}x] ${dup.cat.substring(0,25)} | ${dup.jenis.substring(0,60)}`);
        console.log(`    Statuses: ${dup.all_statuses}`);
    }

    // 2. Cek pengawasan_gantt termasuk is_akhir_spk
    const pgCols = await pool.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'pengawasan_gantt' ORDER BY ordinal_position
    `);
    console.log(`\nKolom pengawasan_gantt: ${pgCols.rows.map(r=>r.column_name).join(', ')}`);

    const pgRes = await pool.query(`
        SELECT *
        FROM pengawasan_gantt
        WHERE id_gantt = 548
        ORDER BY TO_DATE(tanggal_pengawasan, 'DD/MM/YYYY') ASC
    `);
    
    console.log(`\n=== TANGGAL PENGAWASAN SIPIL (gantt 548) ===`);
    for (const pg of pgRes.rows) {
        const cols = Object.keys(pg).map(k => `${k}: ${pg[k]}`).join(' | ');
        console.log(`  ${cols}`);
    }

    // 3. Cek juga pengawasan_gantt untuk gantt 550 (ME)
    const pgMeRes = await pool.query(`
        SELECT *
        FROM pengawasan_gantt
        WHERE id_gantt = 550
        ORDER BY TO_DATE(tanggal_pengawasan, 'DD/MM/YYYY') ASC
    `);
    console.log(`\n=== TANGGAL PENGAWASAN ME (gantt 550) ===`);
    for (const pg of pgMeRes.rows) {
        const cols = Object.keys(pg).map(k => `${k}: ${pg[k]}`).join(' | ');
        console.log(`  ${cols}`);
    }

    // 4. Cek day_gantt_chart untuk SPK info
    const dgcCols = await pool.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'day_gantt_chart' ORDER BY ordinal_position
    `);
    console.log(`\nKolom day_gantt_chart: ${dgcCols.rows.map(r=>r.column_name).join(', ')}`);

    const dgcRes = await pool.query(`
        SELECT * FROM day_gantt_chart WHERE id_gantt_chart IN (548, 550)
    `);
    console.log(`\n=== DAY_GANTT_CHART (SPK extensions) ===`);
    for (const d of dgcRes.rows) {
        const cols = Object.keys(d).map(k => `${k}: ${d[k]}`).join(' | ');
        console.log(`  ${cols}`);
    }

    // 5. Cek missing items ME (gantt 550) - 13 item
    const meMissingRes = await pool.query(`
        WITH latest AS (
            SELECT DISTINCT ON (
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, '')))
            )
                p.kategori_pekerjaan,
                p.jenis_pekerjaan,
                p.status,
                pg.tanggal_pengawasan
            FROM pengawasan p
            JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            WHERE pg.id_gantt = 550
            ORDER BY
                UPPER(TRIM(COALESCE(p.kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(p.jenis_pekerjaan, ''))),
                p.id DESC
        )
        SELECT * FROM latest WHERE LOWER(TRIM(COALESCE(status, ''))) != 'selesai'
    `);
    console.log(`\n=== MISSING ITEMS ME (gantt 550): ${meMissingRes.rows.length} ===`);
    for (const item of meMissingRes.rows) {
        console.log(`  [${item.status}] [tgl:${item.tanggal_pengawasan}] ${item.kategori_pekerjaan} | ${(item.jenis_pekerjaan||'').substring(0,70)}`);
    }

    pool.end();
}

investigatePart2().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
