import * as fs from "fs";
import * as path from "path";

const rabPath = path.resolve(__dirname, "src/modules/rab/rab.service.ts");
let content = fs.readFileSync(rabPath, "utf-8");

// 1. Update uploadLogoToDrive signature
content = content.replace(
    /const uploadLogoToDrive = async \(logoValue: string, filename: string\): Promise<string \| null> => \{/g,
    "const uploadLogoToDrive = async (logoValue: string, filename: string, nomorUlok: string): Promise<string | null> => {"
);
content = content.replace(
    /const uploadedLink = await uploadLogoToDrive\(logoValue, filename\);/g,
    "const uploadedLink = await uploadLogoToDrive(logoValue, filename, payload.nomor_ulok);"
);
content = content.replace(
    /const uploadedLink = await uploadLogoToDrive\(revLogoValue, filename\);/g,
    "const uploadedLink = await uploadLogoToDrive(revLogoValue, filename, payload.nomor_ulok);"
);

// 2. Update uploadPdfToDrive signature
content = content.replace(
    /async function uploadPdfToDrive\(buffer: Buffer, filename: string\): Promise<string> \{/g,
    "async function uploadPdfToDrive(buffer: Buffer, filename: string, nomorUlok: string): Promise<string> {"
);
// Replace callers
content = content.replace(
    /linkSph = await uploadPdfToDrive\([\s\S]*?pdfSph,[\s\S]*?`SPH_\$\{proyek\}_\$\{nomorUlok\}\.pdf`[\s\S]*?\);/g,
    "linkSph = await uploadPdfToDrive(\n        pdfSph,\n        `SPH_${proyek}_${nomorUlok}.pdf`,\n        nomorUlok\n    );"
);
content = content.replace(
    /const linkNonSbo = await uploadPdfToDrive\([\s\S]*?pdfNonSbo,[\s\S]*?`RAB_NON-SBO_\$\{proyek\}_\$\{nomorUlok\}\.pdf`[\s\S]*?\);/g,
    "const linkNonSbo = await uploadPdfToDrive(\n        pdfNonSbo,\n        `RAB_NON-SBO_${proyek}_${nomorUlok}.pdf`,\n        nomorUlok\n    );"
);
content = content.replace(
    /const linkRecap = await uploadPdfToDrive\([\s\S]*?pdfRecap,[\s\S]*?`RAB_REKAPITULASI_\$\{proyek\}_\$\{nomorUlok\}\.pdf`[\s\S]*?\);/g,
    "const linkRecap = await uploadPdfToDrive(\n        pdfRecap,\n        `RAB_REKAPITULASI_${proyek}_${nomorUlok}.pdf`,\n        nomorUlok\n    );"
);
content = content.replace(
    /const linkMerged = await uploadPdfToDrive\([\s\S]*?mergedPdf,[\s\S]*?`RAB_GABUNGAN_\$\{proyek\}_\$\{nomorUlok\}\.pdf`[\s\S]*?\);/g,
    "const linkMerged = await uploadPdfToDrive(\n        mergedPdf,\n        `RAB_GABUNGAN_${proyek}_${nomorUlok}.pdf`,\n        nomorUlok\n    );"
);

// 3. Replace env.PDF_STORAGE_FOLDER_ID with folderId in the 5 functions
content = content.replace(
    /const result = await gp\.uploadFile\(\s*env\.PDF_STORAGE_FOLDER_ID,/g,
    "const folderId = await gp.getOrCreateProcessFolder(\"RAB\", nomorUlok);\n    const result = await gp.uploadFile(\n        folderId,"
);

fs.writeFileSync(rabPath, content);
console.log("Fixed rab.service.ts storage logic");
