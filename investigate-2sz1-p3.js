const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function investigatePart3() {
    console.log('=== BAGIAN 3: DAY_GANTT_CHART & LOGIKA AKHIR SPK ===\n');

    // 1. Fix day_gantt_chart query - column is id_gantt not id_gantt_chart
    const dgcRes = await pool.query(`
        SELECT * FROM day_gantt_chart WHERE id_gantt IN (548, 550)
    `);
    console.log(`=== DAY_GANTT_CHART untuk gantt 548 & 550 ===`);
    for (const d of dgcRes.rows) {
        console.log(`  Gantt: ${d.id_gantt} | h_awal: ${d.h_awal} | h_akhir: ${d.h_akhir} | keterlambatan: ${d.keterlambatan}`);
    }

    // 2. Cek kategori_pekerjaan_gantt (untuk memahami struktur)
    const kpgCols = await pool.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'kategori_pekerjaan_gantt' ORDER BY ordinal_position
    `);
    console.log(`\nKolom kategori_pekerjaan_gantt: ${kpgCols.rows.map(r=>r.column_name).join(', ')}`);

    // 3. Cek apakah ada tabel yang menyimpan info akhir SPK / pertambahan SPK
    const allTables = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND (table_name LIKE '%spk%' OR table_name LIKE '%pertambahan%' OR table_name LIKE '%tambah%')
        ORDER BY table_name
    `);
    console.log(`\nTabel terkait SPK: ${allTables.rows.map(r=>r.table_name).join(', ')}`);

    // 4. Cek gantt_chart columns
    const gcCols = await pool.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'gantt_chart' ORDER BY ordinal_position
    `);
    console.log(`\nKolom gantt_chart: ${gcCols.rows.map(r=>r.column_name).join(', ')}`);

    // 5. Cek gantt_chart record untuk toko ini
    const gcRes = await pool.query(`
        SELECT * FROM gantt_chart WHERE id IN (548, 550)
    `);
    console.log(`\n=== GANTT_CHART INFO (548 SIPIL, 550 ME) ===`);
    for (const gc of gcRes.rows) {
        console.log(`  ID: ${gc.id} | Status: ${gc.status}`);
        // Print all non-null columns
        for (const [k, v] of Object.entries(gc)) {
            if (v !== null && k !== 'id' && k !== 'status') {
                console.log(`    ${k}: ${String(v).substring(0, 100)}`);
            }
        }
    }

    // 6. Cek apakah 30/07 sudah ada record pengawasan (cek isinya)
    const pg30JulyRes = await pool.query(`
        SELECT p.kategori_pekerjaan, p.jenis_pekerjaan, p.status, pg.tanggal_pengawasan, pg.id_gantt
        FROM pengawasan p
        JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
        WHERE pg.id_gantt IN (548, 550) AND pg.tanggal_pengawasan = '30/07/2026'
        LIMIT 5
    `);
    console.log(`\n=== RECORDS DI TANGGAL 30/07/2026 ===`);
    console.log(`Total records: (akan dihitung)`);
    
    const pg30JulyCount = await pool.query(`
        SELECT pg.id_gantt, COUNT(p.id) as total
        FROM pengawasan p
        JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
        WHERE pg.id_gantt IN (548, 550) AND pg.tanggal_pengawasan = '30/07/2026'
        GROUP BY pg.id_gantt
    `);
    for (const r of pg30JulyCount.rows) {
        console.log(`  Gantt ${r.id_gantt}: ${r.total} records di 30/07/2026`);
    }

    // 7. Cek missing ME items (13 item)
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
    console.log(`\n=== MISSING ITEMS ME (gantt 550) ===`);
    console.log(`Total: ${meMissingRes.rows.length}`);
    for (const item of meMissingRes.rows) {
        console.log(`  [${item.status}] [tgl:${item.tanggal_pengawasan}] ${(item.kategori_pekerjaan||'').substring(0,25)} | ${(item.jenis_pekerjaan||'').substring(0,70)}`);
    }

    // 8. Cek total items ME dan SIPIL yang punya record di sistem (bukan missing)
    const totalByScopeRes = await pool.query(`
        SELECT pg.id_gantt,
               COUNT(DISTINCT UPPER(TRIM(COALESCE(p.kategori_pekerjaan,'')))||'|'||UPPER(TRIM(COALESCE(p.jenis_pekerjaan,'')))) as unique_items,
               COUNT(DISTINCT UPPER(TRIM(COALESCE(p.kategori_pekerjaan,'')))||'|'||UPPER(TRIM(COALESCE(p.jenis_pekerjaan,'')))) FILTER (WHERE LOWER(TRIM(p.status)) = 'selesai') as selesai_items
        FROM pengawasan p
        JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
        WHERE pg.id_gantt IN (548, 550)
        GROUP BY pg.id_gantt
    `);
    console.log(`\n=== SUMMARY PER GANTT ===`);
    for (const r of totalByScopeRes.rows) {
        const label = r.id_gantt == 548 ? 'SIPIL' : 'ME';
        console.log(`  ${label} (${r.id_gantt}): ${r.unique_items} unique items total, ${r.selesai_items} selesai`);
    }

    pool.end();
}

investigatePart3().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
