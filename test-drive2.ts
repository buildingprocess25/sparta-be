import { GoogleProvider } from "./src/common/google";
import * as dotenv from "dotenv";
dotenv.config();

async function test() {
    await GoogleProvider.initialize();
    const gp = GoogleProvider.instance;
    const fileId = "1L1HrrgO-wB_7fd3jXBSW9DetZBd4-6O9";
    console.log("SpartaDrive available?", !!gp.spartaDrive);
    console.log("DocDrive available?", !!gp.docDrive);
    
    if (gp.spartaDrive) {
        try {
            const buffer = await gp.getFileBufferById(gp.spartaDrive, fileId, 30000);
            console.log("spartaDrive buffer size:", buffer?.length);
        } catch (e: any) {
            console.error("spartaDrive error:", e.message);
        }
    }
    process.exit(0);
}
test().catch(console.error);
