import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { PengajuanSpkRow } from "./spk.repository";

type BuildSpkPdfInput = {
    pengajuan: PengajuanSpkRow;
    tokoNama: string;
    tokoKode: string;
    tokoAlamat: string;
    tokoCabang: string;
};

const formatTanggal = (isoString: string): string => {
    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
};

const formatTanggalWib = (isoString?: string | null): string => {
    if (!isoString) return "Waktu tidak tersedia";
    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "Waktu tidak tersedia";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm} WIB`;
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

export const buildSpkPdfBuffer = async (input: BuildSpkPdfInput): Promise<Buffer> => {
    const p = input.pengajuan;
    const startFormatted = formatTanggal(p.waktu_mulai);
    const endFormatted = formatTanggal(p.waktu_selesai);
    const today = formatTanggal(new Date().toISOString());
    const totalFormatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(p.grand_total));
    const isBatam = input.tokoCabang.toUpperCase() === "BATAM";
    const initiatorRole = isBatam ? "Branch Building Coordinator" : "Branch Building & Maintenance Manager";

    const normalizeTerbilang = (raw: string): string => {
        return raw
            .replace(/^\(/, "")
            .replace(/\)$/g, "")
            .replace(/\s+Rupiah\s*$/i, "")
            .trim();
    };

    const approvalBlock = (identity?: string | null, approvedAt?: string | null): string => {
        const cleanedIdentity = (identity ?? "").trim();
        if (!cleanedIdentity) return "";
        const approved = `Disetujui pada: ${formatTanggalWib(approvedAt)}`;
        return `
    <div class="approval-details">
        <strong>( ${cleanedIdentity} )</strong><br>
        <span class="timestamp">${approved}</span>
    </div>
    `;
    };

    const logoPath = staticAssetPath("Alfamart-Emblem.png");
    const templatePath = await resolveTemplatePath("spk_report.njk");

    const html = await renderHtmlTemplate(templatePath, {
        logo_path: logoPath,
        spk_location: input.tokoCabang,
        spk_date: today,
        spk_number: p.nomor_spk || "____/PROPNDEV-____/____/____",
        par_number: p.par || "____/PROPNDEV-____-____-____",
        contractor_name: p.nama_kontraktor,
        lingkup_pekerjaan: p.lingkup_pekerjaan,
        proyek: p.proyek,
        project_address: input.tokoAlamat,
        nama_toko: input.tokoNama,
        kode_toko: input.tokoKode,
        total_cost_formatted: totalFormatted,
        terbilang: normalizeTerbilang(p.terbilang),
        start_date: startFormatted,
        end_date: endFormatted,
        duration: p.durasi,
        initiator_details_html: approvalBlock(p.email_pembuat, p.created_at),
        approver_details_html: approvalBlock(p.approver_email, p.waktu_persetujuan),
        initiator_role_title: initiatorRole,
    });

    return renderPdfFromHtml(html);
};
