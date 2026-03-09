// Sama persis dg document_api.py

export const ALLOWED_ROLES = [
    "BRANCH BUILDING SUPPORT",
    "BRANCH BUILDING COORDINATOR",
    "BRANCH BUILDING & MAINTENANCE MANAGER",
    "BRANCH BUILDING & MAINTENANCE ADMINISTRATOR",
];

export const CUSTOM_MIME_MAP: Record<string, string> = {
    ".dwg": "application/acad",
    ".dxf": "application/dxf",
    ".heic": "image/heic",
};

const DATA_URL_RE = /^data:.*?;base64,/i;

/**
 * Sama dg guess_mime() di Python
 */
export function guessMime(filename: string, provided?: string | null): string {
    if (provided) return provided;
    const ext = filename.lastIndexOf(".") >= 0
        ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
        : "";
    if (ext && CUSTOM_MIME_MAP[ext]) return CUSTOM_MIME_MAP[ext];

    // Fallback MIME map sederhana (tanpa dependency tambahan)
    const COMMON_MIME: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".zip": "application/zip",
        ".rar": "application/x-rar-compressed",
        ".txt": "text/plain",
        ".csv": "text/csv",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
    };
    return COMMON_MIME[ext] || "application/octet-stream";
}

/**
 * Sama dg decode_base64_maybe_with_prefix() di Python
 */
export function decodeBase64MaybeWithPrefix(b64Str: string): Buffer {
    if (typeof b64Str !== "string") throw new Error("base64 data bukan string");
    const cleaned = b64Str.trim().replace(DATA_URL_RE, "");
    return Buffer.from(cleaned, "base64");
}
