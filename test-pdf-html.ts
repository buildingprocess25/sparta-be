import * as dotenv from "dotenv";
dotenv.config();
import { GoogleProvider } from "./src/common/google";
import { serahTerimaService } from "./src/modules/serah-terima/serah-terima.service";

async function test() {
    await GoogleProvider.initialize();
    
    // Simulate what the backend does
    console.log("Starting PDF generation test...");
    
    // Ulok id_toko = 1969 is '3V37' (I don't know the ulok, I'll just query it)
    const { pool } = require("./src/config/database");
    const res = await pool.query("SELECT nomor_ulok FROM toko WHERE id = 1969");
    const ulok = res.rows[0].nomor_ulok;
    console.log("Generating for ULOK:", ulok);
    
    try {
        const result = await serahTerimaService.createPdfSerahTerimaUnified(ulok);
        console.log("Generated PDF:", result.filename);
        require("fs").writeFileSync("test-full.pdf", result.buffer);
    } catch (e: any) {
        console.error("Failed to generate PDF:", e.message);
    }
    
    process.exit(0);
}

test().catch(console.error);
