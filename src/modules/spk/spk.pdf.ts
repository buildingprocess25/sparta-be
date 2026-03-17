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

const rupiahFormat = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
};

const formatTanggal = (isoString: string): string => {
    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const d = new Date(isoString);
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
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
        if (!identity) {
            return "<div class=\"approval-details\"><strong>( _________________ )</strong></div>";
        }
        const approved = approvedAt ? `Disetujui pada: ${formatTanggal(approvedAt)}` : "Waktu tidak tersedia";
        return `<div class="approval-details"><strong>( ${identity} )</strong><br>${approved}</div>`;
    };

    const logoPath = `file:///${path
        .resolve(__dirname, "../../../../server/static", "ALFALOGO.png")
        .replace(/\\/g, "/")}`;
    const templatePath = await resolveTemplatePath("spk_report.njk");

    const html = await renderHtmlTemplate(templatePath, {
        logo_path: logoPath,
        spk_location: input.tokoCabang,
        spk_date: today,
        spk_number: p.nomor_spk,
        par_number: p.par || "-",
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
