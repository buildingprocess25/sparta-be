const fs = require('fs');

let code = fs.readFileSync('src/modules/dashboard/dashboard.repository.ts', 'utf8');

// Replace `await client.query` with `pool.query`
code = code.replace(/await client\.query/g, 'pool.query');

// Group the queries into a Promise.all
// Find where rabResult starts
const startIdx = code.indexOf('const rabResult = pool.query');
const endIdx = code.indexOf('const berkasPengawasanResult');

if (startIdx > -1 && endIdx > -1) {
    let queriesBlock = code.substring(startIdx, endIdx);
    
    // Convert `const varName = pool.query<...>(...)` into a list
    // Basically just wrap it in `const [rabResult, ganttResult, ... ] = await Promise.all([ pool.query..., pool.query... ])`
    
    const lines = queriesBlock.split('\n');
    let outLines = [];
    let vars = [];
    
    outLines.push('const [');
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const match = line.match(/const (\w+) = pool\.query/);
        if (match) {
            vars.push(match[1]);
            line = line.replace(/const \w+ = pool\.query/, 'pool.query');
        }
        outLines.push(line);
    }
    
    outLines.unshift('const [' + vars.join(',\n') + '] = await Promise.all([');
    // Find the last query and close it
    // Actually, each query ends with `);`, we need to change it to `),`
    let fixedLines = outLines.join('\n').replace(/\);\s*$/gm, '),');
    // Remove the last comma and close array
    fixedLines = fixedLines.replace(/,\s*$/, '\n]);\n');
    
    code = code.substring(0, startIdx) + fixedLines + code.substring(endIdx);
}

// Remove client completely
code = code.replace(/const client = await pool\.connect\(\);\s*try\s*\{/, '');
code = code.replace(/\}\s*finally\s*\{\s*client\.release\(\);\s*\}/, '');

fs.writeFileSync('src/modules/dashboard/dashboard.repository.ts', code);
console.log("Patched successfully");
