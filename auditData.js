const xlsx = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const NO_ULOK = 'Z001-2512-6969';

async function run() {
    console.log(`\n========== AUDIT DATA: ${NO_ULOK} ==========\n`);

    // 1. Cek toko di DB
    const toko = await pool.query(`SELECT * FROM toko WHERE nomor_ulok = $1`, [NO_ULOK]);
    console.log("=== TOKO di DB ===");
    console.log(toko.rows[0] || "TIDAK ADA");

    if (!toko.rows[0]) { pool.end(); return; }
    const tokoId = toko.rows[0].id;

    // 2. Cek gantt_chart
    const gantt = await pool.query(`SELECT * FROM gantt_chart WHERE id_toko = $1 ORDER BY id DESC LIMIT 1`, [tokoId]);
    console.log("\n=== GANTT_CHART di DB ===");
    console.log(gantt.rows[0] || "TIDAK ADA");
    if (!gantt.rows[0]) { pool.end(); return; }
    const ganttId = gantt.rows[0].id;

    // 3. Cek kategori pekerjaan
    const kat = await pool.query(`SELECT id, kategori_pekerjaan FROM kategori_pekerjaan_gantt WHERE id_gantt = $1 ORDER BY id`, [ganttId]);
    console.log(`\n=== KATEGORI_PEKERJAAN_GANTT di DB (${kat.rows.length} kategori) ===`);
    kat.rows.forEach(r => console.log(`  [${r.id}] ${r.kategori_pekerjaan}`));

    // 4. Cek day_gantt_chart
    const day = await pool.query(`
        SELECT d.id, k.kategori_pekerjaan, d.h_awal, d.h_akhir, d.keterlambatan
        FROM day_gantt_chart d
        JOIN kategori_pekerjaan_gantt k ON k.id = d.id_kategori_pekerjaan_gantt
        WHERE d.id_gantt = $1 ORDER BY d.id`, [ganttId]);
    console.log(`\n=== DAY_GANTT_CHART di DB (${day.rows.length} baris) ===`);
    day.rows.forEach(r => console.log(`  ${r.kategori_pekerjaan.padEnd(40)} h_awal=${r.h_awal.padEnd(5)} h_akhir=${r.h_akhir.padEnd(5)} terlambat=${r.keterlambatan}`));

    // 5. Cek pengawasan
    const peng = await pool.query(`SELECT * FROM pengawasan_gantt WHERE id_gantt = $1 ORDER BY id`, [ganttId]);
    console.log(`\n=== PENGAWASAN_GANTT di DB (${peng.rows.length} entri) ===`);
    peng.rows.forEach(r => console.log(`  ${r.tanggal_pengawasan}`));

    // 6. Cek dependencies
    const dep = await pool.query(`
        SELECT d.id, k1.kategori_pekerjaan AS child, k2.kategori_pekerjaan AS parent
        FROM dependency_gantt d
        JOIN kategori_pekerjaan_gantt k1 ON k1.id = d.id_kategori
        JOIN kategori_pekerjaan_gantt k2 ON k2.id = d.id_kategori_terikat
        WHERE d.id_gantt = $1 ORDER BY d.id`, [ganttId]);
    console.log(`\n=== DEPENDENCY_GANTT di DB (${dep.rows.length} relasi) ===`);
    dep.rows.forEach(r => console.log(`  "${r.child}" bergantung pada "${r.parent}"`));

    // 7. Bandingkan dengan Excel
    console.log("\n\n========== AUDIT EXCEL: Z001-2512-6969 ==========\n");
    const workbook = xlsx.readFile('C:\\alfamart\\SPARTA\\Gantt Chart DB.xlsx');
    const ganttRows = xlsx.utils.sheet_to_json(workbook.Sheets['gantt_chart'], { defval: "", raw: false });
    const dayRows   = xlsx.utils.sheet_to_json(workbook.Sheets['day_gantt_chart'], { defval: "", raw: false });
    const depRows   = xlsx.utils.sheet_to_json(workbook.Sheets['dependency_gantt'], { defval: "", raw: false });

    const excelGantt = ganttRows.find(r => String(r['Nomor Ulok']).trim() === NO_ULOK);
    const excelDays  = dayRows.filter(r => String(r['Nomor Ulok']).trim() === NO_ULOK);
    const excelDeps  = depRows.filter(r => String(r['Nomor Ulok']).trim() === NO_ULOK);

    console.log("=== GANTT HEADER di Excel ===");
    const { Timestamp, ...excelGanttClean } = excelGantt;
    console.log(excelGanttClean);

    console.log(`\n=== DAY_GANTT di Excel (${excelDays.length} baris) ===`);
    excelDays.forEach(r => console.log(`  ${r.Kategori.padEnd(40)} h_awal=${String(r.h_awal).padEnd(12)} h_akhir=${String(r.h_akhir)}`));

    console.log(`\n=== DEPENDENCY di Excel (${excelDeps.length} relasi) ===`);
    excelDeps.forEach(r => console.log(`  "${r.Kategori}" bergantung pada "${r.Kategori_Terikat}"`));

    // 8. Bandingkan summary
    console.log("\n\n========== PERBANDINGAN ==========");
    console.log(`Kategori: Excel=${Object.keys(excelGanttClean).filter(k => k.startsWith('Kategori_') && excelGanttClean[k]).length}  DB=${kat.rows.length}  → ${kat.rows.length === Object.keys(excelGanttClean).filter(k => k.startsWith('Kategori_') && excelGanttClean[k]).length ? '✅ COCOK' : '❌ BEDA'}`);
    console.log(`Day Rows: Excel=${excelDays.length}  DB=${day.rows.length}  → ${day.rows.length === excelDays.length ? '✅ COCOK' : '❌ BEDA'}`);
    const excelPeng = Object.keys(excelGantt).filter(k => k.startsWith('Pengawasan_') && excelGantt[k]).length;
    console.log(`Pengawasan: Excel=${excelPeng}  DB=${peng.rows.length}  → ${peng.rows.length === excelPeng ? '✅ COCOK' : '❌ BEDA'}`);
    console.log(`Dependency: Excel=${excelDeps.length}  DB=${dep.rows.length}  → ${dep.rows.length === excelDeps.length ? '✅ COCOK' : '❌ BEDA'}`);
    console.log(`Toko Nama: Excel="${excelGantt['Nama_Toko']}"  DB="${toko.rows[0].nama_toko}"  → ${toko.rows[0].nama_toko === excelGantt['Nama_Toko'] ? '✅ COCOK' : '❌ BEDA'}`);
    console.log(`Toko Cabang: Excel="${excelGantt['Cabang']}"  DB="${toko.rows[0].cabang}"  → ${toko.rows[0].cabang === excelGantt['Cabang'] ? '✅ COCOK' : '❌ BEDA'}`);

    pool.end();
}

run().catch(e => { console.error(e); pool.end(); });
