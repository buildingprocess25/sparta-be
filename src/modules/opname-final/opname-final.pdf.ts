import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { InstruksiLapanganItemRow } from "../instruksi-lapangan/instruksi-lapangan.repository";
import type { OpnameFinalDetail, OpnameFinalItemRow } from "./opname-final.repository";

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

type GroupedItems<T> = Array<{ category: string; items: T[] }>;

type OpnameItemView = {
    jenis_pekerjaan: string;
    satuan: string;
    volume_rab: number;
    volume_akhir: number;
    selisih_volume: number;
    total_harga_rab_formatted: string;
    total_selisih_formatted: string;
    catatan: string | null;
};

type InstruksiLapanganItemView = {
    jenis_pekerjaan: string;
    satuan: string;
    volume: number;
    harga_material_formatted: string;
    harga_upah_formatted: string;
    total_material_formatted: string;
    total_upah_formatted: string;
    total_harga_formatted: string;
};

const resolveOpnameCategory = (item: OpnameFinalItemRow): string => {
    return String(item.kategori_pekerjaan ?? item.rab_item?.kategori_pekerjaan ?? "")
        .trim()
        .toUpperCase() || "LAIN-LAIN";
};

const resolveOpnameJenis = (item: OpnameFinalItemRow): string => {
    return String(item.jenis_pekerjaan ?? item.rab_item?.jenis_pekerjaan ?? "")
        .trim() || "-";
};

const resolveOpnameSatuan = (item: OpnameFinalItemRow): string => {
    return String(item.satuan ?? item.rab_item?.satuan ?? "")
        .trim() || "-";
};

const buildOpnameGroupedItems = (items: OpnameFinalItemRow[]): GroupedItems<OpnameItemView> => {
    const grouped = new Map<string, OpnameItemView[]>();

    for (const item of items) {
        const category = resolveOpnameCategory(item);
        const totalHargaRab = toNumber(item.total_harga_rab ?? item.rab_item?.total_harga ?? 0);
        const view: OpnameItemView = {
            jenis_pekerjaan: resolveOpnameJenis(item),
            satuan: resolveOpnameSatuan(item),
            volume_rab: toNumber(item.volume_rab ?? item.rab_item?.volume ?? 0),
            volume_akhir: toNumber(item.volume_akhir),
            selisih_volume: toNumber(item.selisih_volume),
            total_harga_rab_formatted: rupiah(totalHargaRab),
            total_selisih_formatted: rupiah(toNumber(item.total_selisih)),
            catatan: item.catatan
        };

        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push(view);
    }

    return Array.from(grouped.entries()).map(([category, groupedItems]) => ({
        category,
        items: groupedItems
    }));
};

const buildInstruksiLapanganGroups = (
    items: InstruksiLapanganItemRow[]
): GroupedItems<InstruksiLapanganItemView> => {
    const grouped = new Map<string, InstruksiLapanganItemView[]>();

    for (const item of items) {
        const category = String(item.kategori_pekerjaan ?? "").trim().toUpperCase() || "LAIN-LAIN";
        const view: InstruksiLapanganItemView = {
            jenis_pekerjaan: String(item.jenis_pekerjaan ?? "").trim() || "-",
            satuan: String(item.satuan ?? "").trim() || "-",
            volume: toNumber(item.volume),
            harga_material_formatted: rupiah(toNumber(item.harga_material)),
            harga_upah_formatted: rupiah(toNumber(item.harga_upah)),
            total_material_formatted: rupiah(toNumber(item.total_material)),
            total_upah_formatted: rupiah(toNumber(item.total_upah)),
            total_harga_formatted: rupiah(toNumber(item.total_harga)),
        };

        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push(view);
    }

    return Array.from(grouped.entries()).map(([category, groupedItems]) => ({
        category,
        items: groupedItems
    }));
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

export const buildOpnameFinalPdfBuffer = async (
    detail: OpnameFinalDetail,
    instruksiLapanganItems: InstruksiLapanganItemRow[] = []
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("opname_final_report.njk");

    const grandTotalOpname = toNumber(detail.opname_final.grand_total_opname);
    const grandTotalRab = toNumber(detail.opname_final.grand_total_rab);
    const opnameItems = detail.items ?? [];
    const kerjaTambahItems = opnameItems.filter((item) => toNumber(item.total_selisih) > 0);
    const kerjaKurangItems = opnameItems.filter((item) => toNumber(item.total_selisih) < 0);

    const html = await renderHtmlTemplate(templatePath, {
        generated_at: formatDateIndonesia(new Date().toISOString()),
        opname_final: detail.opname_final,
        toko: detail.toko,
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
        grouped_items_list: buildOpnameGroupedItems(opnameItems),
        instruksi_lapangan_groups: buildInstruksiLapanganGroups(instruksiLapanganItems),
        kerja_tambah_groups: buildOpnameGroupedItems(kerjaTambahItems),
        kerja_kurang_groups: buildOpnameGroupedItems(kerjaKurangItems),
        grand_total_opname_formatted: rupiah(grandTotalOpname),
        grand_total_rab_formatted: rupiah(grandTotalRab),
        selisih_total_formatted: rupiah(grandTotalOpname - grandTotalRab),
        created_at_formatted: formatDateIndonesia(detail.opname_final.created_at),
    });

    return renderPdfFromHtml(html);
};
