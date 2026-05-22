import fs from "fs";
import path from "path";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { InstruksiLapanganItemRow } from "../instruksi-lapangan/instruksi-lapangan.repository";
import type { OpnameFinalDetail, OpnameFinalItemRow } from "./opname-final.repository";
import type { RabItemRow, RabRow } from "../rab/rab.repository";

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const formatVolume = (value: number | string | null | undefined): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "0";
    const normalized = raw.replace(",", ".");
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return raw;
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(numeric);
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

type RabItemView = {
    jenis_pekerjaan: string;
    satuan: string;
    volume_formatted: string;
    harga_material_formatted: string;
    harga_upah_formatted: string;
    total_material_formatted: string;
    total_upah_formatted: string;
    total_harga_formatted: string;
    catatan: string | null;
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

const buildRabGroupedItems = (items: RabItemRow[]): GroupedItems<RabItemView> => {
    const grouped = new Map<string, RabItemView[]>();

    for (const item of items) {
        const category = String(item.kategori_pekerjaan ?? "").trim().toUpperCase() || "LAIN-LAIN";
        const view: RabItemView = {
            jenis_pekerjaan: String(item.jenis_pekerjaan ?? "").trim() || "-",
            satuan: String(item.satuan ?? "").trim() || "-",
            volume_formatted: formatVolume(item.volume),
            harga_material_formatted: rupiah(toNumber(item.harga_material)),
            harga_upah_formatted: rupiah(toNumber(item.harga_upah)),
            total_material_formatted: rupiah(toNumber(item.total_material)),
            total_upah_formatted: rupiah(toNumber(item.total_upah)),
            total_harga_formatted: rupiah(toNumber(item.total_harga)),
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

const formatDateTimeIndonesia = (value?: string | null): string => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}, ${hh}:${mm} WIB`;
};

const displayName = (name?: string | null, email?: string | null): string => {
    const explicitName = (name ?? "").trim();
    if (explicitName) return explicitName;

    const identity = (email ?? "").trim();
    if (!identity) return "";
    return identity.includes("@") ? identity.split("@")[0] : identity;
};

const approvalDetails = (name?: string | null, email?: string | null, approvedAt?: string | null): string => {
    const identity = displayName(name, email);
    if (!identity) {
        return "<div class=\"approval-details\"><div class=\"approval-date\">&nbsp;</div><div class=\"approval-name\">( _________________ )</div></div>";
    }

    return `<div class="approval-details"><div class="approval-date">${formatDateTimeIndonesia(approvedAt)}</div><div class="approval-name">( ${identity} )</div></div>`;
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
    instruksiLapanganItems: InstruksiLapanganItemRow[] = [],
    rabData?: { header: RabRow | null; items: RabItemRow[] }
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("opname_final_report.njk");

    const grandTotalOpname = toNumber(detail.opname_final.grand_total_opname);
    const grandTotalRab = toNumber(detail.opname_final.grand_total_rab);
    const opnameItems = detail.items ?? [];
    const kerjaTambahItems = opnameItems.filter((item) => toNumber(item.total_selisih) > 0);
    const kerjaKurangItems = opnameItems.filter((item) => toNumber(item.total_selisih) < 0);
    const rabItems = rabData?.items ?? [];
    const rabGrandTotalRaw = rabData?.header?.grand_total_final
        ?? rabData?.header?.grand_total_non_sbo
        ?? rabData?.header?.grand_total
        ?? null;
    const rabGrandTotal = rabGrandTotalRaw !== null && typeof rabGrandTotalRaw !== "undefined"
        ? toNumber(rabGrandTotalRaw)
        : rabItems.reduce((acc, item) => acc + toNumber(item.total_harga), 0);
    const grandTotalIl = instruksiLapanganItems.reduce(
        (acc, item) => acc + toNumber(item.total_harga),
        0
    );
    const grandTotalKerjaTambah = kerjaTambahItems.reduce(
        (acc, item) => acc + toNumber(item.total_selisih),
        0
    );
    const grandTotalKerjaKurang = kerjaKurangItems.reduce(
        (acc, item) => acc + toNumber(item.total_selisih),
        0
    );

    const html = await renderHtmlTemplate(templatePath, {
        generated_at: formatDateIndonesia(new Date().toISOString()),
        opname_final: detail.opname_final,
        toko: detail.toko,
        header_left_logo_path: staticAssetPath("Alfamart-Emblem.png"),
        header_right_logo_path: staticAssetPath("Building-Logo.png"),
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
        grouped_items_list: buildOpnameGroupedItems(opnameItems),
        rab_grouped_items_list: buildRabGroupedItems(rabItems),
        instruksi_lapangan_groups: buildInstruksiLapanganGroups(instruksiLapanganItems),
        kerja_tambah_groups: buildOpnameGroupedItems(kerjaTambahItems),
        kerja_kurang_groups: buildOpnameGroupedItems(kerjaKurangItems),
        grand_total_opname_formatted: rupiah(grandTotalOpname),
        grand_total_rab_formatted: rupiah(grandTotalRab),
        selisih_total_formatted: rupiah(grandTotalOpname - grandTotalRab),
        grand_total_final_rab_formatted: rupiah(rabGrandTotal),
        grand_total_il_formatted: rupiah(grandTotalIl),
        grand_total_kerja_tambah_formatted: rupiah(grandTotalKerjaTambah),
        grand_total_kerja_kurang_formatted: rupiah(grandTotalKerjaKurang),
        created_at_formatted: formatDateIndonesia(detail.opname_final.created_at),
        creator_details: approvalDetails(
            detail.opname_final.nama_pembuat,
            detail.opname_final.email_pembuat,
            detail.opname_final.created_at
        ),
        coordinator_approval_details: approvalDetails(
            detail.opname_final.nama_persetujuan_koordinator,
            detail.opname_final.pemberi_persetujuan_koordinator,
            detail.opname_final.waktu_persetujuan_koordinator
        ),
        manager_approval_details: approvalDetails(
            detail.opname_final.nama_persetujuan_manager,
            detail.opname_final.pemberi_persetujuan_manager,
            detail.opname_final.waktu_persetujuan_manager
        ),
        director_approval_details: approvalDetails(
            detail.opname_final.nama_persetujuan_direktur,
            detail.opname_final.pemberi_persetujuan_direktur,
            detail.opname_final.waktu_persetujuan_direktur
        )
    });

    return renderPdfFromHtml(html);
};
