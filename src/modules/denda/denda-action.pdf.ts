import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { DendaActionRow } from "./denda-action.repository";


type BuildSpPdfInput = {
    action: DendaActionRow;
    tokoNama?: string | null;
    approvedBy: string;
    approvedRole: string;
    approvedAt: string;
    submittedBy: string;
};

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const formatTanggal = (isoString?: string | null): string => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    return new Intl.DateTimeFormat("id-ID", {
        timeZone: JAKARTA_TIME_ZONE,
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(d);
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

const getSpLevelRomawi = (level?: number | null): string => {
    if (level === 1) return "I";
    if (level === 2) return "II";
    if (level === 3) return "III";
    return "";
};

const getAlasanSpText = (alasan?: string | null): string => {
    if (alasan === 'KETERLAMBATAN') return "Keterlambatan Pekerjaan";
    if (alasan === 'MENOLAK_SPK') return "Menolak SPK / Pekerjaan";
    if (alasan === 'MANIPULASI') return "Tindakan Manipulasi / Pelanggaran Berat";
    return alasan ?? "-";
};

export async function buildSuratPeringatanPdfBuffer(input: BuildSpPdfInput): Promise<Buffer> {
    const templatePath = await resolveTemplatePath("surat_peringatan_report.njk");

    const data = {
        logoImageBase64: staticAssetPath("logo_alfamart.png"),
        targetCabang: input.action.cabang ?? "PUSAT",
        spLevelRomawi: getSpLevelRomawi(input.action.sp_level),
        nomorSurat: input.action.nomor_surat ?? "-",
        namaKontraktor: input.action.nama_kontraktor ?? "-",
        idToko: input.action.id_toko,
        nomorUlok: input.action.nomor_ulok ?? "-",
        namaToko: input.tokoNama ?? "-",
        lingkupPekerjaan: input.action.lingkup_pekerjaan ?? "-",
        nomorSpk: input.action.nomor_spk ?? "-",
        tanggalSurat: formatTanggal(input.action.manager_approved_at ?? new Date().toISOString()),
        alasanSpText: getAlasanSpText(input.action.alasan_sp),
        catatan: input.action.catatan ?? "-",
        instruksiTindakLanjut: input.action.instruksi_tindak_lanjut,
        deadlineTindakLanjut: formatTanggal(input.action.deadline_tindak_lanjut),
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
        approvedRole: input.approvedRole,
        submittedBy: input.submittedBy,
    };

    const html = await renderHtmlTemplate(templatePath, data);
    const pdfBuffer = await renderPdfFromHtml(html);

    return pdfBuffer;
}
