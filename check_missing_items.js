const xlsx = require('xlsx');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../sparta-be.env') });

async function checkMissingItems() {
  const url = new URL(process.env.DATABASE_URL);
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false }
  });

  const workbook = xlsx.readFile('C:\\alfamart\\SPARTA\\OPNAME_v1.xlsx');
  const sheet = workbook.Sheets['opname_final'];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  const uloks = ['IPZ1-2603-0002', 'IZ01-2601-0003', 'IZ01-2601-0005', 'TZ01-2512-0002-R', 'WZ01-2602-0026'];
  const missingByUlok = {};

  for (const ulok of uloks) {
    const items = rows.filter(r => String(r.no_ulok).trim().toUpperCase() === ulok);
    console.log(`\nULOK: ${ulok}, Total Opname Items in Excel: ${items.length}`);
    if(items.length === 0) continue;
    
    // get toko ids
    const tokoRes = await pool.query('SELECT id, lingkup_pekerjaan FROM toko WHERE nomor_ulok = $1', [ulok]);
    const tokoMap = {};
    for(const t of tokoRes.rows) {
      tokoMap[t.lingkup_pekerjaan.toUpperCase()] = t.id;
    }
    console.log('Tokos in DB:', tokoMap);

    const missingItems = [];
    for (const item of items) {
      const lingkup = String(item.lingkup_pekerjaan).trim().toUpperCase();
      const idToko = tokoMap[lingkup];
      if(!idToko) {
        // Toko is missing entirely!
        missingItems.push({...item, error: 'Toko not found in DB'});
        continue;
      }

      let found = false;
      const isIL = String(item.IL).trim().toLowerCase() === 'ya';
      const jenisPekerjaan = String(item.jenis_pekerjaan).trim();
      
      if(isIL) {
        // check IL table
        const ilRes = await pool.query('SELECT id FROM instruksi_lapangan WHERE id_toko = $1', [idToko]);
        if(ilRes.rows.length > 0) {
          const ilId = ilRes.rows[0].id;
          const itemRes = await pool.query('SELECT id FROM instruksi_lapangan_item WHERE id_instruksi_lapangan = $1 AND jenis_pekerjaan = $2', [ilId, jenisPekerjaan]);
          found = itemRes.rows.length > 0;
        }
      } else {
        // check RAB table
        const rabRes = await pool.query('SELECT id FROM rab WHERE id_toko = $1', [idToko]);
        if(rabRes.rows.length > 0) {
          const rabId = rabRes.rows[0].id;
          const itemRes = await pool.query('SELECT id FROM rab_item WHERE id_rab = $1 AND jenis_pekerjaan = $2', [rabId, jenisPekerjaan]);
          found = itemRes.rows.length > 0;
        }
      }

      if(!found) {
        missingItems.push(item);
      }
    }
    
    missingByUlok[ulok] = missingItems;
    console.log(`Missing items in DB for ${ulok}: ${missingItems.length}`);
  }

  console.log(JSON.stringify(missingByUlok, null, 2));
  await pool.end();
}

checkMissingItems().catch(console.error);
