import * as fs from "fs";
import * as path from "path";

const rabPath = path.resolve(__dirname, "src/modules/rab/rab.service.ts");
let content = fs.readFileSync(rabPath, "utf-8");

// Fix Signatures
content = content.replace(
    /async\s*\(logoValue:\s*string,\s*filename:\s*string,\s*nomorUlok\?:\s*string(\s*\|\s*null)?,\s*proyek\?:\s*string(\s*\|\s*null)?\)\s*=>/g,
    "async (logoValue: string, filename: string, nomorUlok?: string | null, namaToko?: string | null, kodeToko?: string | null, cabang?: string | null) =>"
);

content = content.replace(
    /async\s*\(\s*file:\s*UploadedFile,\s*nomorUlok:\s*string,\s*proyek\?:\s*string(\s*\|\s*null)?,\s*\)\s*:\s*Promise<string>\s*=>/g,
    "async (file: UploadedFile, nomorUlok: string, namaToko?: string | null, kodeToko?: string | null, cabang?: string | null): Promise<string> =>"
);

content = content.replace(
    /async\s*\(\s*fileValue:\s*string,\s*nomorUlok:\s*string,\s*proyek\?:\s*string(\s*\|\s*null)?,\s*\)\s*:\s*Promise<string>\s*=>/g,
    "async (fileValue: string, nomorUlok: string, namaToko?: string | null, kodeToko?: string | null, cabang?: string | null): Promise<string> =>"
);

content = content.replace(
    /async\s+function\s+uploadPdfToDrive\s*\(buffer:\s*Buffer,\s*filename:\s*string,\s*nomorUlok\?:\s*string(\s*\|\s*null)?,\s*proyek\?:\s*string(\s*\|\s*null)?\)\s*:\s*Promise<string>\s*\{/g,
    "async function uploadPdfToDrive(buffer: Buffer, filename: string, nomorUlok?: string | null, namaToko?: string | null, kodeToko?: string | null, cabang?: string | null): Promise<string> {"
);

// Fix gp.getOrCreateProcessFolder
content = content.replace(
    /gp\.getOrCreateProcessFolder\("RAB",\s*nomorUlok,\s*proyek\)/g,
    "gp.getOrCreateProcessFolder(\"RAB\", nomorUlok, namaToko, kodeToko, cabang)"
);

// Fix callers
content = content.replace(
    /uploadLogoToDrive\(rabHeader\.logo,\s*`RAB_LOGO_\$\{safeProyek\}_\$\{safeUlok\}_\$\{Date\.now\(\)\}\.png`,\s*rabHeader\.nomor_ulok,\s*rabHeader\.proyek\)/g,
    "uploadLogoToDrive(rabHeader.logo, `RAB_LOGO_${safeProyek}_${safeUlok}_${Date.now()}.png`, rabHeader.nomor_ulok, rabHeader.nama_toko, rabHeader.kode_toko, rabHeader.cabang)"
);
content = content.replace(
    /uploadInsuranceStringToDrive\(rabHeader\.file_asuransi,\s*rabHeader\.nomor_ulok,\s*rabHeader\.proyek\)/g,
    "uploadInsuranceStringToDrive(rabHeader.file_asuransi, rabHeader.nomor_ulok, rabHeader.nama_toko, rabHeader.kode_toko, rabHeader.cabang)"
);
content = content.replace(
    /uploadInsuranceFileToDrive\(files\.file_asuransi\[0\],\s*rabHeader\.nomor_ulok,\s*rabHeader\.proyek\)/g,
    "uploadInsuranceFileToDrive(files.file_asuransi[0], rabHeader.nomor_ulok, rabHeader.nama_toko, rabHeader.kode_toko, rabHeader.cabang)"
);
content = content.replace(
    /uploadLogoFileToDrive\(files\.logo\[0\],\s*rabHeader\.nomor_ulok,\s*rabHeader\.proyek\)/g,
    "uploadLogoFileToDrive(files.logo[0], rabHeader.nomor_ulok, rabHeader.nama_toko, rabHeader.kode_toko, rabHeader.cabang)"
);
content = content.replace(
    /uploadPdfToDrive\(pdfGabungan,\s*`RAB_GABUNGAN_\$\{safeProyek\}_\$\{safeUlok\}_\$\{Date\.now\(\)\}\.pdf`,\s*nomorUlok,\s*proyek\)/g,
    "uploadPdfToDrive(pdfGabungan, `RAB_GABUNGAN_${safeProyek}_${safeUlok}_${Date.now()}.pdf`, nomorUlok, fullData.toko.nama_toko, fullData.toko.kode_toko, fullData.toko.cabang)"
);
content = content.replace(
    /uploadPdfToDrive\(pdfNonSbo,\s*`RAB_NON_SBO_\$\{safeProyek\}_\$\{safeUlok\}_\$\{Date\.now\(\)\}\.pdf`,\s*nomorUlok,\s*proyek\)/g,
    "uploadPdfToDrive(pdfNonSbo, `RAB_NON_SBO_${safeProyek}_${safeUlok}_${Date.now()}.pdf`, nomorUlok, fullData.toko.nama_toko, fullData.toko.kode_toko, fullData.toko.cabang)"
);
content = content.replace(
    /uploadPdfToDrive\(pdfRecap,\s*`RAB_REKAPITULASI_\$\{safeProyek\}_\$\{safeUlok\}_\$\{Date\.now\(\)\}\.pdf`,\s*nomorUlok,\s*proyek\)/g,
    "uploadPdfToDrive(pdfRecap, `RAB_REKAPITULASI_${safeProyek}_${safeUlok}_${Date.now()}.pdf`, nomorUlok, fullData.toko.nama_toko, fullData.toko.kode_toko, fullData.toko.cabang)"
);
content = content.replace(
    /uploadPdfToDrive\(pdfSph,\s*`RAB_SPH_\$\{safeProyek\}_\$\{safeUlok\}_\$\{Date\.now\(\)\}\.pdf`,\s*nomorUlok,\s*proyek\)/g,
    "uploadPdfToDrive(pdfSph, `RAB_SPH_${safeProyek}_${safeUlok}_${Date.now()}.pdf`, nomorUlok, fullData.toko.nama_toko, fullData.toko.kode_toko, fullData.toko.cabang)"
);

fs.writeFileSync(rabPath, content);
console.log("Refactored rab.service.ts");
