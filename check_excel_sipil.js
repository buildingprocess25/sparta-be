const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:\\alfamart\\SPARTA\\OPNAME_v1.xlsx');
const sheet = workbook.Sheets['opname_final'];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
const sipilItems = rows.filter(r => String(r.no_ulok).trim().toUpperCase() === '2JZ1-2603-0003' && String(r.lingkup_pekerjaan).trim().toUpperCase() === 'SIPIL');
console.log('Total Sipil items in Excel:', sipilItems.length);
const unmapped = sipilItems.filter(r => 
  r.jenis_pekerjaan && (
    r.jenis_pekerjaan.includes('ACP Satin Grey') || 
    r.jenis_pekerjaan.includes('Siku') ||
    r.jenis_pekerjaan.includes('siku') ||
    r.jenis_pekerjaan.includes('Siku 30x30x3')
  )
);
console.log(JSON.stringify(unmapped, null, 2));
