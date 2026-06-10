const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:\\alfamart\\SPARTA\\Gantt Chart DB.xlsx');

// Print semua kolom dari gantt_chart
const sheetGantt = workbook.Sheets['gantt_chart'];
const ganttRows = xlsx.utils.sheet_to_json(sheetGantt, { defval: "", raw: false });
console.log("=== KOLOM gantt_chart ===");
console.log(Object.keys(ganttRows[0]));
console.log("\n=== SAMPLE ROW gantt_chart ===");
console.log(JSON.stringify(ganttRows[0], null, 2));

// Print kolom day_gantt_chart
const sheetDay = workbook.Sheets['day_gantt_chart'];
const dayRows = xlsx.utils.sheet_to_json(sheetDay, { defval: "", raw: false });
console.log("\n=== KOLOM day_gantt_chart ===");
console.log(Object.keys(dayRows[0]));
console.log("\n=== SAMPLE 2 ROW day_gantt_chart ===");
dayRows.slice(0, 2).forEach(r => console.log(JSON.stringify(r)));

// Print kolom dependency_gantt
const sheetDep = workbook.Sheets['dependency_gantt'];
const depRows = xlsx.utils.sheet_to_json(sheetDep, { defval: "", raw: false });
console.log("\n=== KOLOM dependency_gantt ===");
console.log(Object.keys(depRows[0]));
console.log("\n=== SAMPLE 2 ROW dependency_gantt ===");
depRows.slice(0, 2).forEach(r => console.log(JSON.stringify(r)));
console.log(`\nTotal dep rows: ${depRows.length}`);
