import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { DendaActionRow } from "./sp.repository";


type BuildSpPdfInput = {
    action: DendaActionRow;
    tokoNama?: string | null;
    approvedBy?: string | null;
    approvedRole?: string | null;
    approvedAt?: string | null;
    submittedBy: string;
    submittedAt?: string | null;
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
    const a = (alasan ?? '').toUpperCase();
    if (a === 'KETERLAMBATAN') return "Keterlambatan Pekerjaan";
    if (a === 'MENOLAK_SPK') return "Menolak SPK / Pekerjaan";
    if (a === 'MANIPULASI') return "Tindakan Manipulasi / Pelanggaran Berat";
    if (a === 'LAINNYA') return alasan ?? "Lainnya"; // return the raw alasan which may contain custom text
    return alasan ?? "-";
};

const getKeterlambatanText = (action: DendaActionRow): string | null => {
    if ((action.alasan_sp ?? "").toUpperCase() !== "KETERLAMBATAN") return null;
    const hari = Number(action.hari_denda ?? 0);
    return hari > 0 ? `Keterlambatan ${hari} hari` : "Keterlambatan";
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
        nomorSpk: input.action.nomor_spk?.trim() || null,
        tanggalSurat: formatTanggal(input.action.manager_approved_at ?? input.action.submitted_at ?? input.action.created_at ?? new Date().toISOString()),
        alasanSpText: getKeterlambatanText(input.action) ?? getAlasanSpText(input.action.alasan_sp),
        alasan: (input.action.alasan_sp ?? '').toUpperCase(),
        // Split multi-line catatan into array for numbered list in PDF
        catatanList: (input.action.catatan ?? '').split('\n').filter(l => l.trim()),
        instruksiTindakLanjut: input.action.instruksi_tindak_lanjut,
        deadlineTindakLanjut: formatTanggal(input.action.deadline_tindak_lanjut),
        approvedBy: input.approvedBy ?? null,
        approvedAt: input.approvedAt ?? null,
        approvedRole: input.approvedRole ?? null,
        submittedBy: input.submittedBy,
        submittedAt: input.submittedAt ?? null,
    };

    const html = await renderHtmlTemplate(templatePath, data);
    const pdfBuffer = await renderPdfFromHtml(html);

    return pdfBuffer;
}
