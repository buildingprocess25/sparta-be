import { PDFDocument as PdfLibDocument } from "pdf-lib";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml } from "../../common/html-pdf";
import type { RabRow, RabItemRow, TokoJoinRow } from "./rab.repository";

type BuildRabPdfInput = {
    rab: RabRow;
    items: RabItemRow[];
    toko: TokoJoinRow;
};

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const formatDateIndonesia = (value?: string | null): string => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const formatDateTimeIndonesia = (value?: string | null): string => {
    if (!value) return "Waktu tidak tersedia";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Waktu tidak tersedia";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}, ${hh}:${mm} WIB`;
};

const approvalDetails = (nameOrEmail?: string | null, approvedAt?: string | null): string => {
    const identity = (nameOrEmail ?? "").trim();
    if (!identity) {
        return "<div class=\"approval-details\"><strong>( _________________ )</strong></div>";
    }

    return `<div class="approval-details"><strong>( ${identity} )</strong><br>Disetujui pada: ${formatDateTimeIndonesia(approvedAt)}</div>`;
};

const formatNomorUlok = (raw?: string | null): string => {
    const value = String(raw ?? "").trim();
    if (!value) return "";
    const clean = value.replace(/-/g, "");
    if (clean.length === 13 && clean.endsWith("R")) {
        return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12)}`;
    }
    if (clean.length === 12) {
        return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    return value;
};

const staticAssetPath = (filename: string): string => {
    const fullPath = path.resolve(__dirname, "../../../../server/static", filename);
    return `file:///${fullPath.replace(/\\/g, "/")}`;
};

const buildGroupedItems = (items: RabItemRow[]) => {
    const grouped = new Map<string, {
        category: string;
        items: Array<Record<string, string | number>>;
        subTotalMaterial: number;
        subTotalUpah: number;
        subTotalHarga: number;
    }>();

    for (const item of items) {
        const key = item.kategori_pekerjaan;
        if (!grouped.has(key)) {
            grouped.set(key, {
                category: key,
                items: [],
                subTotalMaterial: 0,
                subTotalUpah: 0,
                subTotalHarga: 0,
            });
        }

        const group = grouped.get(key)!;
        group.items.push({
            jenisPekerjaan: item.jenis_pekerjaan,
            satuan: item.satuan,
            volume: item.volume,
            hargaMaterialFormatted: rupiah(item.harga_material),
            hargaUpahFormatted: rupiah(item.harga_upah),
            totalMaterialFormatted: rupiah(item.total_material),
            totalUpahFormatted: rupiah(item.total_upah),
            totalHargaFormatted: rupiah(item.total_harga),
        });
        group.subTotalMaterial += item.total_material;
        group.subTotalUpah += item.total_upah;
        group.subTotalHarga += item.total_harga;
    }

    return Array.from(grouped.values()).map((group) => ({
        ...group,
        subTotalMaterialFormatted: rupiah(group.subTotalMaterial),
        subTotalUpahFormatted: rupiah(group.subTotalUpah),
        subTotalHargaFormatted: rupiah(group.subTotalHarga),
    }));
};

const isBatamBranch = (cabang?: string | null): boolean => {
    return String(cabang ?? "").trim().toUpperCase() === "BATAM";
};

const computeRecapTotals = (nonSboTotal: number, cabang?: string | null) => {
    const roundedDown = Math.floor(nonSboTotal / 10000) * 10000;
    const ppn = isBatamBranch(cabang) ? 0 : roundedDown * 0.11;
    const finalTotal = roundedDown + ppn;
    return { roundedDown, ppn, finalTotal };
};

/** PDF detail item (Non-SBO atau semua, tergantung items yang dikirim). */
export const buildRabPdfBuffer = async (input: BuildRabPdfInput): Promise<Buffer> => {
    const total = input.items.reduce((acc, item) => acc + Number(item.total_harga || 0), 0);
    const recap = computeRecapTotals(total, input.toko.cabang);
    const templatePath = path.resolve(__dirname, "../../templates/rab_report.njk");
    const isBatam = isBatamBranch(input.toko.cabang);

    const html = await renderHtmlTemplate(templatePath, {
        data: {
            NomorUlok: formatNomorUlok(input.toko.nomor_ulok),
            nama_toko: input.toko.nama_toko ?? "",
            Proyek: input.toko.proyek ?? "",
            Cabang: input.toko.cabang ?? "",
            Alamat: input.toko.alamat ?? "",
            LingkupPekerjaan: input.toko.lingkup_pekerjaan ?? "",
            DurasiPekerjaan: input.rab.durasi_pekerjaan ?? "",
            KategoriLokasi: input.rab.kategori_lokasi ?? "",
            LuasAreaParkir: input.rab.luas_area_parkir ?? "",
            LuasAreaSales: input.rab.luas_area_sales ?? "",
            LuasGudang: input.rab.luas_gudang ?? "",
            LuasBangunan: input.rab.luas_bangunan ?? "",
            LuasAreaTerbuka: input.rab.luas_area_terbuka ?? "",
            LuasTerbangun: input.rab.luas_terbangun ?? "",
        },
        grouped_items_list: buildGroupedItems(input.items),
        grand_total: rupiah(total),
        pembulatan: rupiah(recap.roundedDown),
        ppn: rupiah(recap.ppn),
        final_grand_total: rupiah(recap.finalTotal),
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
        tanggal_pengajuan: formatDateIndonesia(input.rab.created_at),
        nama_pt: input.rab.nama_pt || "NAMA PT. KONTRAKTOR TIDAK ADA",
        is_batam_branch: isBatam,
        creator_details: approvalDetails(input.rab.email_pembuat, input.rab.created_at),
        coordinator_approval_details: approvalDetails(
            input.rab.pemberi_persetujuan_koordinator,
            input.rab.waktu_persetujuan_koordinator,
        ),
        manager_approval_details: approvalDetails(
            input.rab.pemberi_persetujuan_manager,
            input.rab.waktu_persetujuan_manager,
        ),
    });

    return renderPdfFromHtml(html);
};

/** PDF Rekapitulasi - ringkasan total per kategori pekerjaan. */
export const buildRecapPdfBuffer = async (input: BuildRabPdfInput): Promise<Buffer> => {
    const templatePath = path.resolve(__dirname, "../../templates/rab_recap_report.njk");
    const grouped = new Map<string, { material: number; upah: number; total: number }>();

    for (const item of input.items) {
        const key = item.kategori_pekerjaan;
        if (!grouped.has(key)) {
            grouped.set(key, { material: 0, upah: 0, total: 0 });
        }
        const row = grouped.get(key)!;
        row.material += Number(item.total_material || 0);
        row.upah += Number(item.total_upah || 0);
        row.total += Number(item.total_harga || 0);
    }

    const category_totals_list = Array.from(grouped.entries()).map(([name, value]) => ({
        name,
        materialFormatted: rupiah(value.material),
        upahFormatted: rupiah(value.upah),
        totalFormatted: rupiah(value.total),
        totalRaw: value.total,
    }));

    const grandTotal = category_totals_list.reduce((acc, row) => acc + row.totalRaw, 0);
    const recap = computeRecapTotals(grandTotal, input.toko.cabang);

    const html = await renderHtmlTemplate(templatePath, {
        data: {
            NomorUlok: formatNomorUlok(input.toko.nomor_ulok),
            nama_toko: input.toko.nama_toko ?? "",
            Proyek: input.toko.proyek ?? "",
            Cabang: input.toko.cabang ?? "",
            Alamat: input.toko.alamat ?? "",
            LingkupPekerjaan: input.toko.lingkup_pekerjaan ?? "",
            DurasiPekerjaan: input.rab.durasi_pekerjaan ?? "",
            KategoriLokasi: input.rab.kategori_lokasi ?? "",
        },
        category_totals_list,
        grand_total_formatted: rupiah(grandTotal),
        pembulatan_formatted: rupiah(recap.roundedDown),
        ppn_formatted: rupiah(recap.ppn),
        final_total_formatted: rupiah(recap.finalTotal),
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
        tanggal_pengajuan: formatDateIndonesia(input.rab.created_at),
        nama_pt: input.rab.nama_pt || "NAMA PT. KONTRAKTOR TIDAK ADA",
    });

    return renderPdfFromHtml(html);
};

/** Merge PDF valid (bukan concat byte mentah) untuk meniru flow backend server. */
export const mergePdfBuffers = async (pdfBuffers: Buffer[]): Promise<Buffer> => {
    const merged = await PdfLibDocument.create();

    for (const pdfBuffer of pdfBuffers) {
        if (!pdfBuffer || pdfBuffer.length === 0) {
            continue;
        }

        const source = await PdfLibDocument.load(pdfBuffer);
        const pages = await merged.copyPages(source, source.getPageIndices());
        for (const page of pages) {
            merged.addPage(page);
        }
    }

    const bytes = await merged.save();
    return Buffer.from(bytes);
};