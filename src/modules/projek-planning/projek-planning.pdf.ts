import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { ProjekPlanningRow } from "./projek-planning.repository";

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const formatDateIndonesia = (value?: string | null): string => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} pukul ${date.getHours().toString().padStart(2, '0')}.${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatCurrency = (value?: string | number | null): string => {
    if (!value) return "0";
    return Number(value).toLocaleString("id-ID");
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

export const buildProjekPlanningPdfBuffer = async (
    projek: ProjekPlanningRow
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("projek_planning_report.njk");

    const html = await renderHtmlTemplate(templatePath, {
        projek,
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
        logo_path: staticAssetPath("Logo_Alfamart_transparent.png"),
        created_at_formatted: formatDateIndonesia(projek.created_at),
        bm_waktu_formatted: formatDateIndonesia(projek.bm_waktu_persetujuan),
        pp2_waktu_formatted: formatDateIndonesia(projek.pp2_waktu_persetujuan),
        pp_manager_waktu_formatted: formatDateIndonesia(projek.pp_manager_waktu_persetujuan),
        estimasi_biaya_formatted: formatCurrency(projek.estimasi_biaya),
        generated_at: formatDateIndonesia(new Date().toISOString())
    });

    return renderPdfFromHtml(html);
};
