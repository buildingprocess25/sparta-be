const fs = require('fs');

let code = fs.readFileSync('src/modules/dashboard/dashboard.repository.ts', 'utf8');

// 1. Remove `const client = await pool.connect();` and `try {` block
code = code.replace(/const client = await pool\.connect\(\);\s*try\s*\{/, '');
// Remove the finally block at the end
code = code.replace(/\}\s*finally\s*\{\s*client\.release\(\);\s*\}/, '');

// 2. Replace all `client.query` with `pool.query` ONLY in findAllDashboard
let startIdx = code.indexOf('async findAllDashboard');
let endIdx = code.indexOf('async findDokumentasiBangunanForExport');

let dashCode = code.substring(startIdx, endIdx);
dashCode = dashCode.replace(/client\.query/g, 'pool.query');

// 3. Batch 1: rabResult to pengawasanPdfPendingResult
let batch1Start = dashCode.indexOf('const rabResult = await pool.query');
let batch1End = dashCode.indexOf('const rabIds = rabResult.rows.map');
if(batch1Start > -1 && batch1End > -1) {
    let b1Code = dashCode.substring(batch1Start, batch1End);
    let out = b1Code;
    
    // Convert declarations
    const vars = [
        'rabResult', 'ganttResult', 'spkResult', 'picResult',
        'instruksiResult', 'opnameFinalResult', 'berkasSerahTerimaResult',
        'projectPlanningResult', 'pengawasanPdfPendingResult'
    ];
    
    out = out.replace(/const \w+Result = await pool\.query/g, 'pool.query');
    out = out.replace(/\);/g, '),');
    out = out.replace(/,\s*$/, '\n]);\n\n');
    out = `const [\n    ${vars.join(',\n    ')}\n] = await Promise.all([\n` + out;
    
    dashCode = dashCode.substring(0, batch1Start) + out + dashCode.substring(batch1End);
}

// 4. Batch 2: kategoriGanttResult to opnameItemResult
let batch2Start = dashCode.indexOf('const kategoriGanttResult = await pool.query');
let batch2End = dashCode.indexOf('const pengawasanGanttIds = pengawasanGanttResult.rows.map');
if(batch2Start > -1 && batch2End > -1) {
    let b2Code = dashCode.substring(batch2Start, batch2End);
    let out = b2Code;
    
    const vars = [
        'kategoriGanttResult', 'dayGanttResult', 'pengawasanGanttResult', 'pengawasanResult',
        'dependencyGanttResult', 'spkLogResult', 'pertambahanResult', 'rabItemResult',
        'instruksiItemResult', 'opnameItemResult'
    ];
    
    out = out.replace(/const \w+Result = await pool\.query/g, 'pool.query');
    out = out.replace(/\);/g, '),');
    out = out.replace(/,\s*$/, '\n]);\n\n');
    out = `const [\n    ${vars.join(',\n    ')}\n] = await Promise.all([\n` + out;
    
    dashCode = dashCode.substring(0, batch2Start) + out + dashCode.substring(batch2End);
}

// 5. Fix indentation for the whole function body since we removed `try {`
const lines = dashCode.split('\n');
const indentedLines = lines.map(l => {
    if (l.startsWith('    ') && !l.startsWith('    async')) {
        return l.substring(4); // remove 4 spaces
    }
    return l;
});
dashCode = indentedLines.join('\n');

code = code.substring(0, startIdx) + dashCode + code.substring(endIdx);

fs.writeFileSync('src/modules/dashboard/dashboard.repository.ts', code);
console.log('Patch complete.');
