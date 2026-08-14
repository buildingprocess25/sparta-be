import * as fs from "fs";
import * as path from "path";

const rabPath = path.resolve(__dirname, "src/modules/rab/rab.service.ts");
let content = fs.readFileSync(rabPath, "utf-8");

// My previous script injected `gp.getOrCreateProcessFolder("RAB", nomorUlok, namaToko, kodeToko, cabang)`. Let's revert it.
content = content.replace(
    /gp\.getOrCreateProcessFolder\("RAB",\s*nomorUlok,\s*namaToko,\s*kodeToko,\s*cabang\)/g,
    "gp.getOrCreateProcessFolder(\"RAB\", nomorUlok)"
);

// My previous script also modified callers:
// uploadLogoToDrive(rabHeader.logo, `...`, rabHeader.nomor_ulok, rabHeader.nama_toko, rabHeader.kode_toko, rabHeader.cabang)
// Let's change them back to passing proyek (or just leave them passing more args since JS ignores extra args, but wait! The signatures still have `proyek` as the 4th argument!)
// If the signature is (logoValue, filename, nomorUlok, proyek) and I pass (logo, filename, nomor_ulok, nama_toko, kode_toko, cabang), then `proyek` receives `nama_toko`! 
// This is perfectly fine, since `proyek` is not used anymore (I removed it from `getOrCreateProcessFolder`).
// But wait, the TS error was:
// src/modules/rab/rab.service.ts(1054,45): error TS2304: Cannot find name 'proyek'.
// Oh! In `uploadInsuranceFileToDrive`, line 1054 might be using `proyek`! Let's check line 1054.
// `const safeProyek = sanitizeFilenamePart(proyek, "PROYEK");`
// So it IS used in filename generation! 
// So I MUST restore the `proyek` argument being passed correctly to the functions.

content = content.replace(
    /uploadLogoToDrive\(([^,]+),\s*([^,]+),\s*rabHeader\.nomor_ulok,\s*rabHeader\.nama_toko,\s*rabHeader\.kode_toko,\s*rabHeader\.cabang\)/g,
    "uploadLogoToDrive($1, $2, rabHeader.nomor_ulok, rabHeader.proyek)"
);
content = content.replace(
    /uploadInsuranceStringToDrive\(([^,]+),\s*rabHeader\.nomor_ulok,\s*rabHeader\.nama_toko,\s*rabHeader\.kode_toko,\s*rabHeader\.cabang\)/g,
    "uploadInsuranceStringToDrive($1, rabHeader.nomor_ulok, rabHeader.proyek)"
);
content = content.replace(
    /uploadInsuranceFileToDrive\(([^,]+),\s*rabHeader\.nomor_ulok,\s*rabHeader\.nama_toko,\s*rabHeader\.kode_toko,\s*rabHeader\.cabang\)/g,
    "uploadInsuranceFileToDrive($1, rabHeader.nomor_ulok, rabHeader.proyek)"
);
content = content.replace(
    /uploadLogoFileToDrive\(([^,]+),\s*rabHeader\.nomor_ulok,\s*rabHeader\.nama_toko,\s*rabHeader\.kode_toko,\s*rabHeader\.cabang\)/g,
    "uploadLogoFileToDrive($1, rabHeader.nomor_ulok, rabHeader.proyek)"
);
content = content.replace(
    /uploadPdfToDrive\(([^,]+),\s*([^,]+),\s*nomorUlok,\s*fullData\.toko\.nama_toko,\s*fullData\.toko\.kode_toko,\s*fullData\.toko\.cabang\)/g,
    "uploadPdfToDrive($1, $2, nomorUlok, proyek)"
);

fs.writeFileSync(rabPath, content);
console.log("Fixed rab.service.ts");
