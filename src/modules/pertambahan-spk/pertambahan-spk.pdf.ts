import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";

type BuildPertambahanSpkPdfInput = {
    nomorUlok: string;
    nomorSpk: string;
    cabang?: string | null;
    tanggalSpkAkhir: string;
    tanggalSpkAkhirSetelahPerpanjangan: string;
    pertambahanHari: string;
    alasanPerpanjangan: string;
    dibuatOleh: string;
    dibuatPada?: string | null;
    disetujuiOleh?: string | null;
    disetujuiPada?: string | null;
};

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const formatDateIndonesia = (value?: string | null): string => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const formatDateTimeIndonesia = (value?: string | null): string => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    const formatter = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    return `${formatter.format(date)} WIB`;
};

const staticAssetPath = (filename: string): string => {
    const candidates = [
        path.resolve(__dirname, "../../image", filename),
        path.resolve(__dirname, "../../../src/image", filename),
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

const formatSigner = (value?: string | null): string => {
    const normalized = (value ?? "").trim();
    if (!normalized) {
        return "( ____________________ )";
    }

    return `( ${normalized.toUpperCase()} )`;
};

export const buildPertambahanSpkPdfBuffer = async (
    input: BuildPertambahanSpkPdfInput
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("pertambahan_spk_report.njk");
    const html = await renderHtmlTemplate(templatePath, {
        logo_alfamart: staticAssetPath("Alfamart-Emblem.png"),
        logo_watermark: staticAssetPath("Building-Logo.png"),
        cabang_label: (input.cabang ?? "").toUpperCase() || "BATAM",
        tanggal_surat: formatDateIndonesia(new Date().toISOString()),
        nomor_ulok: input.nomorUlok,
        nomor_spk: input.nomorSpk,
        tanggal_spk_akhir: formatDateIndonesia(input.tanggalSpkAkhir),
        pertambahan_hari: `${input.pertambahanHari} hari`,
        tanggal_spk_akhir_setelah_perpanjangan: formatDateIndonesia(input.tanggalSpkAkhirSetelahPerpanjangan),
        alasan_perpanjangan: input.alasanPerpanjangan,
        dibuat_oleh: formatSigner(input.dibuatOleh),
        disetujui_oleh: formatSigner(input.disetujuiOleh),
        dibuat_pada: formatDateTimeIndonesia(input.dibuatPada),
        disetujui_pada: formatDateTimeIndonesia(input.disetujuiPada),
    });

    return renderPdfFromHtml(html);
};
