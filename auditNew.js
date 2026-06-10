const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:\\alfamart\\SPARTA\\Gantt Chart DB.xlsx');
const ganttRows = xlsx.utils.sheet_to_json(workbook.Sheets['gantt_chart'], { defval: "", raw: false });
const excelRow = ganttRows.find(r => String(r['Nomor Ulok']).trim() === 'Z001-2512-6969');

async function run() {
    const toko = await pool.query(`SELECT alamat, nama_kontraktor FROM toko WHERE nomor_ulok = 'Z001-2512-6969'`);
    const gantt = await pool.query(`SELECT timestamp FROM gantt_chart WHERE id_toko = (SELECT id FROM toko WHERE nomor_ulok = 'Z001-2512-6969' LIMIT 1) ORDER BY id DESC LIMIT 1`);

    const dbAlamat = toko.rows[0]?.alamat;
    const dbKontraktor = toko.rows[0]?.nama_kontraktor;
    const dbTimestamp = gantt.rows[0]?.timestamp?.toISOString().slice(0,10);

    const excelTimestamp = String(excelRow['Timestamp'] || '').slice(0,10);

    console.log(`Alamat:         Excel="${excelRow['Alamat']}"  DB="${dbAlamat}"  → ${dbAlamat === excelRow['Alamat'] ? '✅ COCOK' : '❌ BEDA'}`);
    console.log(`Nama_Kontraktor:Excel="${excelRow['Nama_Kontraktor']}"  DB="${dbKontraktor}"  → ${dbKontraktor === excelRow['Nama_Kontraktor'] ? '✅ COCOK' : '❌ BEDA'}`);
    console.log(`Timestamp:      Excel="${excelTimestamp}"  DB="${dbTimestamp}"  → ${dbTimestamp === excelTimestamp ? '✅ COCOK' : '❌ BEDA'}`);
    pool.end();
}
run();
