require("dotenv").config();
const { resolveDriveImageDataUrl } = require("./src/common/drive-image");

async function test() {
    const url = "https://drive.google.com/file/d/1L1HrrgO-wB_7fd3jXBSW9DetZBd4-6O9/view?usp=drivesdk";
    console.log("Testing:", url);
    const result = await resolveDriveImageDataUrl(url);
    if (!result) {
        console.error("Result is NULL! Image failed to resolve.");
    } else {
        console.log("Result starts with:", result.substring(0, 50));
    }
}
test().catch(console.error);
