import * as fs from "fs";
import * as path from "path";

const rabPath = path.resolve(__dirname, "src/modules/rab/rab.service.ts");
let content = fs.readFileSync(rabPath, "utf-8");

content = content.replace(
    /gp\.getOrCreateProcessFolder\("RAB",\s*nomorUlok,\s*proyek\)/g,
    "gp.getOrCreateProcessFolder(\"RAB\", nomorUlok)"
);

fs.writeFileSync(rabPath, content);
console.log("Fixed rab.service.ts");
