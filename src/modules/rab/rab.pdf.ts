import { PDFDocument as PdfLibDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
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

const monthToRoman = (month: number): string => {
    const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return romans[month - 1] ?? "I";
};

const buildSphDocumentNumber = (
    noSph: number | null | undefined,
    kodeToko: string | null | undefined,
    dateValue?: string | null
): string => {
    const numberPart = Math.max(Number(noSph ?? 0), 1);
    const kodeTokoPart = String(kodeToko ?? "-").trim() || "-";
    const baseDate = dateValue ? new Date(dateValue) : new Date();
    const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const monthRoman = monthToRoman(safeDate.getMonth() + 1);
    const year = safeDate.getFullYear();
    return `${numberPart}/${kodeTokoPart}/SPH/${monthRoman}/${year}`;
};

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

const terbilang = (angka: number): string => {
    const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    let hasil = "";
    if (angka < 12) {
        hasil = huruf[angka];
    } else if (angka < 20) {
        hasil = terbilang(angka - 10) + " Belas";
    } else if (angka < 100) {
        hasil = terbilang(Math.floor(angka / 10)) + " Puluh " + terbilang(angka % 10);
    } else if (angka < 200) {
        hasil = "Seratus " + terbilang(angka - 100);
    } else if (angka < 1000) {
        hasil = terbilang(Math.floor(angka / 100)) + " Ratus " + terbilang(angka % 100);
    } else if (angka < 2000) {
        hasil = "Seribu " + terbilang(angka - 1000);
    } else if (angka < 1000000) {
        hasil = terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
    } else if (angka < 1000000000) {
        hasil = terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
    } else if (angka < 1000000000000) {
        hasil = terbilang(Math.floor(angka / 1000000000)) + " Milyar " + terbilang(angka % 1000000000);
    }
    return hasil.trim() + " Rupiah";
};

const staticAssetPath = (filename: string): string => {
    const candidates = [
        // Works for dev and build: src/modules/rab -> src/image, dist/modules/rab -> dist/image
        path.resolve(__dirname, "../../image", filename),
        // Build mode (dist): dist/modules/rab -> src/image
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

const buildGroupedItems = (items: RabItemRow[]) => {
    const grouped = new Map<string, {
        category: string;
        items: Array<Record<string, string | number>>;
        subTotalMaterial: number;
        subTotalUpah: number;
        subTotalHarga: number;
    }>();

    for (const item of items) {
        const safeCategory = String(item.kategori_pekerjaan ?? "").trim() || "LAIN-LAIN";
        const safeJenisPekerjaan = String(item.jenis_pekerjaan ?? "").trim() || "-";
        const key = safeCategory;
        if (!grouped.has(key)) {
            grouped.set(key, {
                category: safeCategory,
                items: [],
                subTotalMaterial: 0,
                subTotalUpah: 0,
                subTotalHarga: 0,
            });
        }

        const group = grouped.get(key)!;
        group.items.push({
            jenisPekerjaan: safeJenisPekerjaan,
            satuan: item.satuan,
            volume: item.volume,
            hargaMaterialFormatted: rupiah(item.harga_material),
            hargaUpahFormatted: rupiah(item.harga_upah),
            totalMaterialFormatted: rupiah(item.total_material),
            totalUpahFormatted: rupiah(item.total_upah),
            totalHargaFormatted: rupiah(item.total_harga),
            catatan: String(item.catatan ?? "").trim(),
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
    const templatePath = await resolveTemplatePath("rab_report.njk");
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
    const templatePath = await resolveTemplatePath("rab_recap_report.njk");
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

export const generateSphPdf = async (
    input: BuildRabPdfInput & { logoOverride?: string | null }
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("rab_sph_report.njk");

    const total = input.items.reduce((acc, item) => acc + Number(item.total_harga || 0), 0);
    const recap = computeRecapTotals(total, input.toko.cabang);
    const finalTotal = recap.finalTotal;

    const referenceDate = input.rab.waktu_persetujuan_direktur || input.rab.created_at;

    const html = await renderHtmlTemplate(templatePath, {
        nomor_sph: buildSphDocumentNumber(input.rab.no_sph, input.toko.kode_toko, referenceDate),
        langsung: true,
        proyek: input.toko.proyek || "Alfamart",
        lingkup_pekerjaan: input.toko.lingkup_pekerjaan || "Sipil",
        nama_toko: input.toko.nama_toko || "", 
        grand_total: rupiah(finalTotal),
        grand_total_terbilang: terbilang(finalTotal),
        tanggal_persetujuan: input.rab.waktu_persetujuan_direktur 
            ? formatDateIndonesia(input.rab.waktu_persetujuan_direktur)
            : formatDateIndonesia(input.rab.created_at),
        nama_pt: input.rab.nama_pt || "PT. ONTOSENO BAYUAJI",
        nama_direktur: input.rab.pemberi_persetujuan_direktur || "__________________",
        fallback_logo: input.logoOverride || input.rab.logo || staticAssetPath("Building-Logo.png")
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