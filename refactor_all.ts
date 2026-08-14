import * as fs from "fs";
import * as path from "path";

const filesToFix = [
    "pertambahan-spk/pertambahan-spk.service.ts",
    "instruksi-lapangan/instruksi-lapangan.service.ts",
    "pengawasan/pengawasan.service.ts",
    "opname/opname.service.ts",
    "opname-final/opname-final.service.ts",
    "serah-terima/serah-terima.service.ts",
];

filesToFix.forEach(f => {
    const filePath = path.resolve(__dirname, "src/modules", f);
    let content = fs.readFileSync(filePath, "utf-8");

    // Replace gp.getOrCreateProcessFolder("...", nomorUlok, proyek);
    // with gp.getOrCreateProcessFolder("...", nomorUlok);
    content = content.replace(
        /gp\.getOrCreateProcessFolder\((["'][^"']+["']),\s*(nomorUlok|context\.nomor_ulok|input\.action\.nomor_ulok|spk\.pengajuan\.nomor_ulok),\s*proyek\)/g,
        "gp.getOrCreateProcessFolder($1, $2)"
    );

    // Also fix uploadPdfToDrive/etc signatures to not need proyek? No, just leave them as is, 
    // because removing proyek from getOrCreateProcessFolder is enough!
    // But wait, there is one place in spk.service.ts we already fixed.

    fs.writeFileSync(filePath, content);
    console.log("Refactored", f);
});
