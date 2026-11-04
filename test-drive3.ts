import { GoogleProvider } from "./src/common/google";
import { resolveDriveImageDataUrl } from "./src/common/drive-image";
import * as dotenv from "dotenv";
dotenv.config();

async function test() {
    await GoogleProvider.initialize();
    const url = "https://drive.google.com/file/d/1446M39uPVWWCMVicZI63fqDz_4liZuVp/view?usp=drivesdk";
    console.log("Resolving:", url);
    const result = await resolveDriveImageDataUrl(url);
    if (!result) {
        console.error("Result is NULL! Image failed to resolve.");
    } else {
        console.log("Result starts with:", result.substring(0, 50));
    }
    process.exit(0);
}
test().catch(console.error);
