import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { SerahTerimaDetail } from "./serah-terima.repository";

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const formatDateIndonesia = (value?: string | null): string => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const staticAssetPath = (filename: string): string => {
    const candidates = [
        // Works for dev and build: src/modules/serah-terima -> src/image, dist/modules/serah-terima -> dist/image
        path.resolve(__dirname, "../../image", filename),
        // Build mode (dist): dist/modules/serah-terima -> src/image
        path.resolve(__dirname, "../../../src/image", filename),
        // Legacy fallback
        path.resolve(__dirname, "../../../../server/static", filename),
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

export const buildSerahTerimaPdfBuffer = async (detail: SerahTerimaDetail): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("serah_terima_report.njk");

    const grandTotalOpname = toNumber(detail.opname_final.grand_total_opname);
    const grandTotalRab = toNumber(detail.opname_final.grand_total_rab);

    const html = await renderHtmlTemplate(templatePath, {
        generated_at: formatDateIndonesia(new Date().toISOString()),
        opname_final: detail.opname_final,
        toko: detail.toko,
        items: detail.items.map((item) => ({
            ...item,
            total_selisih_formatted: rupiah(item.total_selisih),
            total_harga_rab_formatted: rupiah(toNumber(item.total_harga_rab)),
            total_harga_opname_formatted: rupiah(item.total_harga_opname),
        })),
        grand_total_opname_formatted: rupiah(grandTotalOpname),
        grand_total_rab_formatted: rupiah(grandTotalRab),
        selisih_total_formatted: rupiah(grandTotalOpname - grandTotalRab),
        created_at_formatted: formatDateIndonesia(detail.opname_final.created_at),
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
    });

    return renderPdfFromHtml(html);
};
