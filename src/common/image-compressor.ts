import path from "path";
import sharp from "sharp";

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "heim", "heis", "hevm", "mif1", "msf1"]);

/** Check whether a binary buffer starts with an ISO BMFF HEIC/HEIF brand box. */
export function isHeicBuffer(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
    return HEIC_BRANDS.has(buffer.toString("ascii", 8, 12).toLowerCase());
}

function isHeicFile(file: Pick<Express.Multer.File, "buffer" | "mimetype" | "originalname">): boolean {
    const mime = (file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();
    return mime.includes("heic") || mime.includes("heif") || ext === ".heic" || ext === ".heif" || isHeicBuffer(file.buffer);
}

/** Decode a HEIC/HEIF buffer into a JPEG buffer using pure-JS heic-convert. */
export async function convertHeicToJpegBuffer(buffer: Buffer, quality = 0.8): Promise<Buffer> {
    const heicConvert = require("heic-convert") as (opts: {
        buffer: Buffer;
        format: "JPEG" | "PNG";
        quality?: number;
    }) => Promise<ArrayBuffer | Uint8Array>;
    const converted = await heicConvert({ buffer, format: "JPEG", quality });
    return converted instanceof Uint8Array ? Buffer.from(converted) : Buffer.from(new Uint8Array(converted));
}

const toJpegFilename = (originalname: string): string => {
    if (!originalname.toLowerCase().endsWith(".jpg") && !originalname.toLowerCase().endsWith(".jpeg")) {
        return originalname.replace(/\.[^/.]+$/, "") + ".jpg";
    }
    return originalname;
};

export async function compressImage(file: Express.Multer.File): Promise<{ buffer: Buffer; mimetype: string; originalname: string }> {
    if (!file.mimetype.startsWith("image/") && !isHeicFile(file)) {
        return { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname };
    }

    try {
        const compressedBuffer = await sharp(file.buffer)
            .resize({ width: 1920, withoutEnlargement: true }) // Limit width to 1920px max
            .jpeg({ quality: 75 }) // Compress aggressively but safely (75% quality JPEG)
            .toBuffer();

        return { buffer: compressedBuffer, mimetype: "image/jpeg", originalname: toJpegFilename(file.originalname) };
    } catch (error) {
        if (isHeicFile(file)) {
            try {
                const jpegBuffer = await convertHeicToJpegBuffer(file.buffer, 0.8);
                const compressedBuffer = await sharp(jpegBuffer)
                    .resize({ width: 1920, withoutEnlargement: true })
                    .jpeg({ quality: 75 })
                    .toBuffer();
                return { buffer: compressedBuffer, mimetype: "image/jpeg", originalname: toJpegFilename(file.originalname) };
            } catch (heicError) {
                console.error("Failed to convert HEIC image:", heicError);
            }
        }
        console.error("Failed to compress image:", error);
        return { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname };
    }
}
