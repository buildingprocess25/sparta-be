import { GoogleProvider } from "./src/common/google";
import * as dotenv from "dotenv";
dotenv.config();

async function test() {
    const gp = GoogleProvider.instance;
    await new Promise(r => setTimeout(r, 2000)); // wait for auth
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
    if (gp.docDrive) {
        try {
            const buffer = await gp.getFileBufferById(gp.docDrive, fileId, 30000);
            console.log("docDrive buffer size:", buffer?.length);
        } catch (e: any) {
            console.error("docDrive error:", e.message);
        }
    }
    process.exit(0);
}
test().catch(console.error);
