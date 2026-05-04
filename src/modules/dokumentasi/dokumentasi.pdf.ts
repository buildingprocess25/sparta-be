import fs from "fs";
import path from "path";
import { env } from "../../config/env";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { DokumentasiBangunanDetail } from "./dokumentasi.repository";

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const formatDateIndonesia = (value?: string | null): string => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const staticAssetPath = (filename: string): string => {
    const candidates = [
        path.resolve(__dirname, "../../image", filename),
        path.resolve(__dirname, "../../../src/image", filename),
        path.resolve(__dirname, "../../../../server/static", filename)
    ];

    for (const assetPath of candidates) {
        if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath).toLowerCase();
            const mimeType = ext === ".png"
                ? "image/png"
                : ext === ".jpg" || ext === ".jpeg"
                    ? "image/jpeg"
                    : "application/octet-stream";
            const base64 = fs.readFileSync(assetPath).toString("base64");
            return `data:${mimeType};base64,${base64}`;
        }
    }

    return "";
};

const resolveFallbackPhoto = (): string => {
    const fileId = env.DOC_BANGUNAN_DEFAULT_PHOTO_ID;
    if (!fileId) return "";
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
    if (size <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

export const buildDokumentasiBangunanPdfBuffer = async (
    detail: DokumentasiBangunanDetail
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("dokumentasi_bangunan_report.njk");
    const fallbackPhoto = resolveFallbackPhoto();

    const items = detail.items.map((item, index) => ({
        index: index + 1,
        link_foto: item.link_foto || fallbackPhoto
    }));

    const photoPages = chunkArray(items, 6);

    const html = await renderHtmlTemplate(templatePath, {
        dokumentasi: detail.dokumentasi,
        photo_pages: photoPages,
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
        tanggal_go_formatted: formatDateIndonesia(detail.dokumentasi.tanggal_go),
        tanggal_serah_terima_formatted: formatDateIndonesia(detail.dokumentasi.tanggal_serah_terima),
        tanggal_ambil_foto_formatted: formatDateIndonesia(detail.dokumentasi.tanggal_ambil_foto),
        generated_at: formatDateIndonesia(new Date().toISOString())
    });

    return renderPdfFromHtml(html);
};
