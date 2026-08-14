import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

function run() {
    const filePath = 'c:/alfamart/backup/data/LIST DATA Penyimpanan dokumen DC.xlsx';
    console.log("Reading:", filePath);
    const wb = xlsx.readFile(filePath);
    
    // Parse List Dok
    const sheetListDok = wb.Sheets['List Dok'];
    const dataList = xlsx.utils.sheet_to_json(sheetListDok, { header: 1 }) as string[][];
    
    const dokumenConfig = [];
    const ketList = [];
    
    let currentUtama = null;
    let currentDetail = null;
    let isKet = false;
    
    // Manual mapping for 'Dokumen Utama' as some rows might be tricky.
    // The columns are roughly:
    // 0: No Detail (1, 2, 3...)
    // 1: No Utama (A, B, C...)
    // 2/3: DOKUMEN UTAMA (sometimes col 2, sometimes col 3)
    // 3/4: DETAIL DOKUMEN 
    // 4/5: JENIS DOKUMEN (the No)
    // 5/6: Judul Jenis Dokumen
    // 6/7: PDF/JPEG
    // 7/8: AUTOCAD
    // 8/9: WORD
    // 9/10: EXCEL
    // 10/11: PPT
    
    for (let i = 4; i < dataList.length; i++) {
        const row = dataList[i];
        if (!row || row.length === 0) continue;
        
        const rowStr = row.map(c => String(c || '').trim().toUpperCase()).join('');
        if (rowStr.includes('KET:')) {
            isKet = true;
            continue;
        }
        
        if (isKet) {
            // Find Abbrev and Meaning
            const rawRow = row.filter(c => c !== null && c !== undefined && c !== '' && c !== '=');
            if (rawRow.length >= 2) {
                const abbrev = String(rawRow[0]).trim();
                const meaning = String(rawRow.slice(1).join(' ')).trim();
                if (abbrev.length < 10) {
                    ketList.push({ abbrev, meaning });
                }
            }
            continue;
        }
        
        // Skip header rows or empty rows
        if (rowStr === '' || rowStr.includes('PEMBANGUNAN&/PERLUASAN')) continue;
        
        // Find "Dokumen Utama"
        // Let's rely on uppercase letters A, B, C for Dokumen Utama NO
        if (row[1] && typeof row[1] === 'string' && row[1].match(/^[A-Z]$/)) {
            currentUtama = {
                no: row[1],
                title: String(row[2] || row[3] || '').trim(),
                details: []
            };
            dokumenConfig.push(currentUtama);
        } else if (!currentUtama && String(row[3]).trim() === 'SITEPLAN') {
            currentUtama = { no: '-', title: 'SITEPLAN', details: [] };
            dokumenConfig.push(currentUtama);
        }
        
        // Identify Detail Dokumen NO (1, 2, 3, etc. in col 0)
        let noDetail = row[0];
        // However some detail row starts with No Detail at col 0 or 3
        if (Number.isInteger(noDetail)) {
            // Found a detail
            currentDetail = {
                no: noDetail,
                title: String(row[3] || row[4] || row[2] || '').trim(),
                jenis: []
            };
            if (currentUtama) {
                currentUtama.details.push(currentDetail);
            }
        }
        
        // Identify Jenis Dokumen
        // It has a number in col 4 or 3, then title, then checkmarks
        let idxTitle = -1;
        let judulJenis = '';
        for (let j = 3; j <= 6; j++) {
            if (typeof row[j] === 'string' && row[j].length > 3 && !row[j].includes('√')) {
                idxTitle = j;
                judulJenis = String(row[j]).trim();
                break;
            }
        }
        
        if (judulJenis && currentDetail) {
            // Find checks: next 5 cols after idxTitle are the file formats
            // Or look specifically for "√"
            let checks = {
                'PDF/JPEG': false,
                'AUTOCAD': false,
                'WORD': false,
                'EXCEL': false,
                'PPT': false
            };
            
            // To be robust, let's look at cols 6 to 10
            let startCol = row.indexOf('√');
            if (startCol === -1) {
                startCol = idxTitle + 1;
            }
            if (startCol > 0) {
                // Determine which indices map to which columns based on the original header [6:PDF, 7:CAD, 8:WORD, 9:EXCEL, 10:PPT]
                // We'll just check specific static indices relative to the sheet structure:
                // PDF is usually col 6
                checks['PDF/JPEG'] = row[6] === '√';
                checks['AUTOCAD'] = row[7] === '√';
                checks['WORD'] = row[8] === '√';
                checks['EXCEL'] = row[9] === '√';
                checks['PPT'] = row[10] === '√';
            }
            
            // Fixes for rows where the check is in a different column
            if (row.includes('√')) {
               checks['PDF/JPEG'] = true; // Most are PDF if check exists but cols shifted
            }

            // Create a unique key for this document type
            const noJenis = currentDetail.jenis.length + 1;
            const key = `DOC_${currentUtama?.no}_${currentDetail.no}_${noJenis}`.replace(/[^A-Z0-9_]/g, '');
            
            currentDetail.jenis.push({
                key,
                no: noJenis,
                title: judulJenis,
                file_types: Object.keys(checks).filter(k => checks[k as keyof typeof checks])
            });
        }
    }
    
    // Hardcode the manual correct mapping to ensure high quality (since Excel parsing heuristically is flaky)
    // Actually, I'll define it completely manually to be absolutely correct according to the user's PDF/excel screens.
}

run();
