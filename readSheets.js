const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:\\alfamart\\SPARTA\\Gantt Chart DB.xlsx');
console.log("Sheet names: ", workbook.SheetNames);
for (const sheetName of workbook.SheetNames) {
    console.log(`--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    console.log(rows.slice(0, 2));
}
