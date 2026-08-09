const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/alfamart/SPARTA/sparta-be/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function investigateSipilItems() {
    const idToko = 1884; // SULTAN HASANUDIN BUOL
    
    console.log('=== INVESTIGASI ITEM SIPIL (id_toko: 1884) ===\n');
    
    // 1. Cek schema tabel rab
    const rabCols = await pool.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'rab' ORDER BY ordinal_position
    `);
    console.log('Kolom RAB:', rabCols.rows.map(r => r.column_name).join(', '));
    
    // 2. Cek RAB items untuk toko ini
    const rabRes = await pool.query(`
        SELECT ri.kategori_pekerjaan, ri.jenis_pekerjaan
        FROM rab r
        JOIN rab_item ri ON ri.id_rab = r.id
        WHERE r.id_toko = $1
        ORDER BY ri.kategori_pekerjaan, ri.jenis_pekerjaan
    `, [idToko]);
    console.log(`\nTotal RAB items untuk toko ${idToko}: ${rabRes.rows.length}`);
    
    // 3. Cek 66 item yang belum selesai di SIPIL (gantt 548)
    const missingRes = await pool.query(`
        WITH pengawasan_per_date AS (
            SELECT p.*, pg.tanggal_pengawasan
            FROM pengawasan p
            JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
            WHERE pg.id_gantt = 548
        ),
        latest_per_item AS (
            SELECT DISTINCT ON (
                UPPER(TRIM(COALESCE(kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(jenis_pekerjaan, '')))
            )
                kategori_pekerjaan,
                jenis_pekerjaan,
                status,
                tanggal_pengawasan,
                id
            FROM pengawasan_per_date
            ORDER BY
                UPPER(TRIM(COALESCE(kategori_pekerjaan, ''))),
                UPPER(TRIM(COALESCE(jenis_pekerjaan, ''))),
                id DESC
        )
        SELECT kategori_pekerjaan, jenis_pekerjaan, status, tanggal_pengawasan
        FROM latest_per_item
        WHERE LOWER(TRIM(COALESCE(status, ''))) != 'selesai'
        ORDER BY kategori_pekerjaan, jenis_pekerjaan
    `, []);
    
    console.log(`\n=== 66 ITEM YANG BELUM SELESAI (SIPIL gantt_id: 548) ===`);
    console.log(`Total: ${missingRes.rows.length}\n`);
    
    const rabItems = rabRes.rows;
    let inRab = 0, notInRab = 0;
    
    for (const item of missingRes.rows) {
        const cat = (item.kategori_pekerjaan || '').toUpperCase().trim();
        const jenis = (item.jenis_pekerjaan || '').toUpperCase().trim();
        
        const foundInRab = rabItems.some(r => 
            (r.kategori_pekerjaan || '').toUpperCase().trim() === cat && 
            (r.jenis_pekerjaan || '').toUpperCase().trim() === jenis
        );
        
        if (foundInRab) inRab++; else notInRab++;
        
        const mark = foundInRab ? '✓ RAB' : '? ORPHAN';
        console.log(`[${mark}] [${item.status}] [tgl:${item.tanggal_pengawasan}] ${cat.substring(0, 30)} | ${jenis.substring(0, 70)}`);
    }
    
    console.log(`\nTotal: ${missingRes.rows.length} | Ada di RAB: ${inRab} | Tidak di RAB: ${notInRab}`);
    
    // 4. Cek duplikat
    const dupRes = await pool.query(`
        SELECT 
            UPPER(TRIM(COALESCE(kategori_pekerjaan, ''))) as cat,
            UPPER(TRIM(COALESCE(jenis_pekerjaan, ''))) as jenis,
            COUNT(*) as total_records,
            STRING_AGG(status, ', ' ORDER BY id DESC) as all_statuses
        FROM pengawasan p
        JOIN pengawasan_gantt pg ON pg.id = p.id_pengawasan_gantt
        WHERE pg.id_gantt = 548
        GROUP BY 
            UPPER(TRIM(COALESCE(kategori_pekerjaan, ''))),
            UPPER(TRIM(COALESCE(jenis_pekerjaan, '')))
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 20
    `, []);
    
    console.log(`\n=== ITEM DENGAN LEBIH DARI 1 RECORD ===`);
    console.log(`Total unique item dengan multiple records: ${dupRes.rows.length}`);
    for (const dup of dupRes.rows.slice(0, 10)) {
        console.log(`  [${dup.total_records} records] ${dup.cat.substring(0,25)} | ${dup.jenis.substring(0,60)}`);
        console.log(`    Statuses: ${dup.all_statuses}`);
    }
    
    // 5. Cek pengawasan_gantt untuk SIPIL (tanggal akhir SPK)
    const pgRes = await pool.query(`
        SELECT id, tanggal_pengawasan, is_akhir_spk, catatan
        FROM pengawasan_gantt
        WHERE id_gantt = 548
        ORDER BY TO_DATE(tanggal_pengawasan, 'DD/MM/YYYY') ASC
    `, []);
    
    console.log(`\n=== TANGGAL PENGAWASAN SIPIL (gantt 548) ===`);
    for (const pg of pgRes.rows) {
        const isAkhir = pg.is_akhir_spk ? ' [AKHIR SPK]' : '';
        console.log(`  ${pg.tanggal_pengawasan}${isAkhir} (ID: ${pg.id})`);
    }
    
    // 6. Cek gantt chart info termasuk SPK extensions
    const gcRes = await pool.query(`
        SELECT id, id_toko, status, timestamp
        FROM gantt_chart
        WHERE id IN (548, 550)
    `, []);
    console.log(`\n=== GANTT CHART INFO ===`);
    for (const gc of gcRes.rows) {
        console.log(`  ID: ${gc.id}, Status: ${gc.status}, Timestamp: ${gc.timestamp}`);
    }
    
    pool.end();
}

investigateSipilItems().catch(e => { console.error(e.message); process.exit(1); });
