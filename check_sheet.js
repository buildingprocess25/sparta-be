const fs = require('fs');
const https = require('https');
const xlsx = require('xlsx');

const fileUrl = 'https://docs.google.com/spreadsheets/d/1ssXGBJ-D4O8JVB1emOBuqcdmBKvdymciVsv7eMaBb64/export?format=xlsx';
const dest = 'C:/alfamart/SPARTA/sparta-be/test_download.xlsx';

https.get(fileUrl, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (res2) => {
            const file = fs.createWriteStream(dest);
            res2.pipe(file);
            file.on('finish', () => {
                file.close(() => processFile());
            });
        });
    } else {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
            file.close(() => processFile());
        });
    }
});

function text(val) {
    if (val === null || val === undefined) return "";
    return String(val).trim();
}

function numberValue(value) {
    const raw = text(value).replace(/\s/g, "");
    if (!raw) return 0;
    const normalized = raw.includes(",")
        ? raw.replace(/\./g, "").replace(",", ".")
        : (raw.match(/\./g) || []).length > 1
            ? raw.replace(/\./g, "")
        : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function processFile() {
    console.log('Processing file...');
    const buffer = fs.readFileSync(dest);
    const workbook = xlsx.read(buffer, { type: "buffer", cellDates: false });
    
    // Find the opname_final sheet or just use the first sheet
    const sheetName = workbook.SheetNames.find(n => n.includes('opname_final')) || workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: false });
    
    let found = false;
    rows.forEach((row, index) => {
        const volRab = numberValue(row.vol_rab);
        const selisihVolume = numberValue(row.selisih);
        const volumeAkhir = volRab + selisihVolume;
        
        if (volumeAkhir > 1000) {
            console.log(`FOUND HUGE VOLUME at index ${index} (row ${index + 2})!`);
            console.log(`- jenis_pekerjaan:`, row.jenis_pekerjaan);
            console.log(`- vol_rab:`, row.vol_rab, `-> parsed:`, volRab);
            console.log(`- selisih:`, row.selisih, `-> parsed:`, selisihVolume);
            console.log(`- volume_akhir:`, volumeAkhir);
            found = true;
        }
    });
    
    if (!found) {
        console.log('No volume > 1000 found in the entire file!');
    }
}
