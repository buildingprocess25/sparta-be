import path from "path";
import sharp from "sharp";
import { GoogleProvider } from "./google";

const extractDriveFileId = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const byIdParam = /[?&]id=([^&]+)/.exec(trimmed);
    if (byIdParam?.[1]) return byIdParam[1];

    const byPath = /\/d\/([^/]+)/.exec(trimmed);
    if (byPath?.[1]) return byPath[1];

    return null;
};

const normalizeDriveDownloadLink = (value: string): string => {
    const fileId = extractDriveFileId(value);
    if (!fileId) return value;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const inferImageMimeType = (buffer: Buffer, explicitMime?: string | null, filename?: string | null): string | null => {
    const mime = (explicitMime ?? "").toLowerCase();
    if (mime.startsWith("image/")) return mime;

    if (buffer.length >= 12) {
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
        if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    }

    const ext = path.extname(filename ?? "").toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";

    return null;
};

export const resolveDriveImageDataUrl = async (rawLink?: string | null): Promise<string | null> => {
    const link = (rawLink ?? "").trim();
    if (!link) return null;

    try {
        const fileId = extractDriveFileId(link);
        const gp = GoogleProvider.instance;
        let buffer: Buffer | null = null;
        let mimeType: string | null = null;
        let filename: string | null = null;

        if (fileId && gp.spartaDrive) {
            buffer = await gp.getFileBufferById(gp.spartaDrive, fileId);

            try {
                const meta = await gp.spartaDrive.files.get({ fileId, fields: "name,mimeType" });
                filename = meta.data.name ?? null;
                mimeType = meta.data.mimeType ?? null;
            } catch {
                // Metadata is best-effort; image inference can still use the buffer.
            }
        }

        if (!buffer && /^https?:\/\//i.test(link)) {
            const response = await fetch(normalizeDriveDownloadLink(link));
            if (!response.ok) return null;
            buffer = Buffer.from(await response.arrayBuffer());
            mimeType = response.headers.get("content-type");
        }

        if (!buffer?.length) return null;

        const imageMime = inferImageMimeType(buffer, mimeType, filename);
        if (!imageMime) return null;

        try {
            const sharpInstance = sharp(buffer, { failOn: "none" });
            const meta = await sharpInstance.metadata();
            if (meta.width && (meta.width > 800 || (meta.height && meta.height > 800))) {
                buffer = await sharpInstance
                    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
            } else {
                buffer = await sharpInstance
                    .jpeg({ quality: 80 })
                    .toBuffer();
            }
            return `data:image/jpeg;base64,${buffer.toString("base64")}`;
        } catch (err) {
            console.warn("[drive-image] Gagal mengompres gambar menggunakan sharp, menggunakan gambar asli:", err);
            return `data:${imageMime};base64,${buffer.toString("base64")}`;
        }
    } catch (error) {
        console.warn("[pdf-image] Gagal memuat foto Drive untuk PDF", {
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

