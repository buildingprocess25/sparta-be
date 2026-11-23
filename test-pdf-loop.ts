import * as dotenv from "dotenv";
dotenv.config();
import { GoogleProvider } from "./src/common/google";
import { getSerahTerimaDetail } from "./src/modules/serah-terima/serah-terima.service";
import { resolveDriveImageDataUrl } from "./src/common/drive-image";

async function test() {
    await GoogleProvider.initialize();
    
    // Gunakan opname_final ID 808
    const detail = await getSerahTerimaDetail(808);
    console.log(`Found ${detail.items.length} items`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < Math.min(5, detail.items.length); i++) {
        const item = detail.items[i];
        console.log(`Item ${i}: ID=${item.id}, foto=${item.foto}`);
        if (item.foto) {
            const dataUrl = await resolveDriveImageDataUrl(item.foto);
            if (dataUrl) {
                console.log(` -> SUCCESS! size: ${dataUrl.length}`);
                successCount++;
            } else {
                console.log(` -> FAILED! resolveDriveImageDataUrl returned null`);
                failCount++;
            }
        } else {
            console.log(` -> NO PHOTO IN DB`);
        }
    }
    
    console.log(`Done. Success: ${successCount}, Fail: ${failCount}`);
    process.exit(0);
}

test().catch(console.error);
