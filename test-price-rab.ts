import { config } from "dotenv";
config({ path: "./sparta-be.env" });

import { priceRabService } from "./src/modules/price-rab/price-rab.service";
import { GoogleProvider } from "./src/common/google";
import * as path from "path";

async function run() {
    try {
        console.log("Initializing Google Provider...");
        process.env.GOOGLE_TOKEN_PATH = path.resolve("token.json");
        process.env.GOOGLE_DOC_TOKEN_PATH = path.resolve("token_doc.json");
        
        await GoogleProvider.initialize();

        console.log("Testing priceRabService.getData with lingkup=GABUNGAN...");
        const result = await priceRabService.getData("HEAD OFFICE", "GABUNGAN");
        
        console.log("Result keys:", Object.keys(result));
        const firstCategory = Object.keys(result)[0];
        if (firstCategory) {
            console.log(`Sample items from ${firstCategory}:`, result[firstCategory].slice(0, 2));
        }

    } catch (e) {
        console.error("Test failed:", e);
    }
}

run();
