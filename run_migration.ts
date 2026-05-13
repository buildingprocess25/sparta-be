import { pool } from "./src/db/pool";
import * as fs from "fs";
import * as path from "path";

const sqlPath = path.join(__dirname, "sql", "2026-05-13-add-ruko-kompetitor-projek-planning.sql");
const sqlContent = fs.readFileSync(sqlPath, "utf-8");

pool.query(sqlContent)
    .then(() => {
        console.log("Migration successful");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
