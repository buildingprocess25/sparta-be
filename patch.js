const fs = require('fs');
let code = fs.readFileSync('src/modules/dashboard/dashboard.repository.ts', 'utf8');

// Replace client with pool
code = code.replace(/const client = await pool\.connect\(\);\s*try\s*\{/, '');
code = code.replace(/\}\s*finally\s*\{\s*client\.release\(\);\s*\}/, '');
code = code.replace(/client\.query/g, 'pool.query');

let parts = code.split('const rabResult = await pool.query');
if (parts.length > 1) {
    let secondHalf = parts[1];
    
    // Batch 1
    let batch1End = secondHalf.indexOf('const rabIds =');
    let batch1 = secondHalf.substring(0, batch1End);
    
    let batch1Fixed = batch1.replace(/const (\w+)Result = await pool\.query/g, 'pool.query');
    batch1Fixed = batch1Fixed.replace(/\);\s*$/gm, '),\n');
    batch1Fixed = batch1Fixed.replace(/,\n$/, '\n]);\n\n');
    batch1Fixed = `const [\n    rabResult,\n    ganttResult,\n    spkResult,\n    picResult,\n    instruksiResult,\n    opnameFinalResult,\n    berkasSerahTerimaResult,\n    projectPlanningResult,\n    pengawasanPdfPendingResult\n] = await Promise.all([\n    pool.query` + batch1Fixed;

    secondHalf = batch1Fixed + secondHalf.substring(batch1End);
    
    // Batch 2
    let batch2Start = secondHalf.indexOf('const kategoriGanttResult = await pool.query');
    let batch2End = secondHalf.indexOf('const pengawasanGanttIds =');
    let batch2 = secondHalf.substring(batch2Start, batch2End);
    
    let batch2Fixed = batch2.replace(/const (\w+)Result = await pool\.query/g, 'pool.query');
    batch2Fixed = batch2Fixed.replace(/\);\s*$/gm, '),\n');
    batch2Fixed = batch2Fixed.replace(/,\n$/, '\n]);\n\n');
    batch2Fixed = `const [\n    kategoriGanttResult,\n    dayGanttResult,\n    pengawasanGanttResult,\n    pengawasanResult,\n    dependencyGanttResult,\n    spkLogResult,\n    pertambahanResult,\n    rabItemResult,\n    instruksiItemResult,\n    opnameItemResult\n] = await Promise.all([\n    ` + batch2Fixed;
    
    secondHalf = secondHalf.substring(0, batch2Start) + batch2Fixed + secondHalf.substring(batch2End);
    
    code = parts[0] + secondHalf;
}

// Unindent the whole method block
let lines = code.split('\n');
let inside = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('async findAllDashboard')) inside = true;
    if (inside && lines[i].startsWith('    ') && !lines[i].includes('async findAllDashboard')) {
        lines[i] = lines[i].substring(4);
    }
    if (inside && lines[i] === '    },') inside = false;
}

fs.writeFileSync('src/modules/dashboard/dashboard.repository.ts', lines.join('\n'));
console.log('done');
