import fs from "fs";
import path from "path";
import { resolveDriveImageDataUrl } from "../../common/drive-image";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { InstruksiLapanganItemRow } from "../instruksi-lapangan/instruksi-lapangan.repository";
import type { OpnameFinalDetail, OpnameFinalItemRow } from "./opname-final.repository";
import type { RabItemRow, RabRow } from "../rab/rab.repository";

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const roundDownTenThousand = (value: number): number => {
    const numeric = Number(value) || 0;
    const sign = numeric < 0 ? -1 : 1;
    return sign * Math.floor(Math.abs(numeric) / 10000) * 10000;
};

const roundUpTenThousand = (value: number): number => {
    const numeric = Number(value) || 0;
    if (numeric === 0) return 0;
    const sign = numeric < 0 ? -1 : 1;
    return sign * Math.ceil(Math.abs(numeric) / 10000) * 10000;
};

const normalizeNoPpnText = (value?: string | null): string => String(value ?? "").trim().toUpperCase();

const isNoPpnArea = (toko: { cabang?: string | null; nama_toko?: string | null; alamat?: string | null }): boolean => {
    const identity = [
        toko.cabang,
        toko.nama_toko,
        toko.alamat,
    ].map(normalizeNoPpnText);

    return identity.some(value => value === "BATAM" || value === "BINTAN" || /\bBATAM\b|\bBINTAN\b/.test(value));
};

const buildFinancialSummary = (total: number, direction: "down" | "up", noPpn = false) => {
    const pembulatan = direction === "down"
        ? roundDownTenThousand(total)
        : roundUpTenThousand(total);
    const ppn = noPpn ? 0 : Math.round(pembulatan * 0.11);
    const grandTotal = pembulatan + ppn;

    return {
        total,
        total_formatted: rupiah(total),
        pembulatan,
        pembulatan_formatted: rupiah(pembulatan),
        ppn,
        ppn_formatted: rupiah(ppn),
        grand_total: grandTotal,
        grand_total_formatted: rupiah(grandTotal)
    };
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

type GroupSummary = ReturnType<typeof buildFinancialSummary>;

type GroupedItems<T> = Array<{ category: string; items: T[]; summary: GroupSummary }>;

const sortOpnameItemsByRabOrder = (items: OpnameFinalItemRow[]): OpnameFinalItemRow[] => {
    return [...items].sort((left, right) => {
        const leftRabId = Number(left.rab_item?.id ?? left.id_rab_item ?? Number.MAX_SAFE_INTEGER);
        const rightRabId = Number(right.rab_item?.id ?? right.id_rab_item ?? Number.MAX_SAFE_INTEGER);

        if (leftRabId !== rightRabId) return leftRabId - rightRabId;

        const leftIlId = Number(left.instruksi_lapangan_item?.id ?? left.id_instruksi_lapangan_item ?? Number.MAX_SAFE_INTEGER);
        const rightIlId = Number(right.instruksi_lapangan_item?.id ?? right.id_instruksi_lapangan_item ?? Number.MAX_SAFE_INTEGER);
        if (leftIlId !== rightIlId) return leftIlId - rightIlId;

        return Number(left.id) - Number(right.id);
    });
};

const sumOpnameTotalSelisih = (items: OpnameFinalItemRow[]): number => {
    return items.reduce((acc, item) => acc + toNumber(item.total_selisih), 0);
};

const sumRabTotalHarga = (items: RabItemRow[]): number => {
    return items.reduce((acc, item) => acc + toNumber(item.total_harga), 0);
};

const sumInstruksiLapanganTotalHarga = (items: InstruksiLapanganItemRow[]): number => {
    return items.reduce((acc, item) => acc + toNumber(item.total_harga), 0);
};

type OpnameItemView = {
    jenis_pekerjaan: string;
    satuan: string;
    volume_rab: number;
    volume_akhir: number;
    selisih_volume: number;
    total_harga_rab_formatted: string;
    total_selisih_formatted: string;
    foto_data_url: string | null;
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

const buildOpnameGroupedItems = async (items: OpnameFinalItemRow[], noPpn = false): Promise<GroupedItems<OpnameItemView>> => {
    const grouped = new Map<string, OpnameItemView[]>();
    const totals = new Map<string, number>();

    for (const item of items) {
        const category = resolveOpnameCategory(item);
        const totalHargaRab = toNumber(item.total_harga_rab ?? item.rab_item?.total_harga ?? 0);
        const totalSelisih = toNumber(item.total_selisih);
        const view: OpnameItemView = {
            jenis_pekerjaan: resolveOpnameJenis(item),
            satuan: resolveOpnameSatuan(item),
            volume_rab: toNumber(item.volume_rab ?? item.rab_item?.volume ?? 0),
            volume_akhir: toNumber(item.volume_akhir),
            selisih_volume: toNumber(item.selisih_volume),
            total_harga_rab_formatted: rupiah(totalHargaRab),
            total_selisih_formatted: rupiah(totalSelisih),
            foto_data_url: await resolveDriveImageDataUrl(item.foto),
            catatan: item.catatan
        };

        if (!grouped.has(category)) {
            grouped.set(category, []);
            totals.set(category, 0);
        }
        grouped.get(category)!.push(view);
        totals.set(category, (totals.get(category) ?? 0) + totalSelisih);
    }

    return Array.from(grouped.entries()).map(([category, groupedItems]) => ({
        category,
        items: groupedItems,
        summary: buildFinancialSummary(totals.get(category) ?? 0, "up", noPpn)
    }));
};

const buildInstruksiLapanganGroups = (
    items: InstruksiLapanganItemRow[],
    noPpn = false
): GroupedItems<InstruksiLapanganItemView> => {
    const grouped = new Map<string, InstruksiLapanganItemView[]>();
    const totals = new Map<string, number>();

    for (const item of items) {
        const category = String(item.kategori_pekerjaan ?? "").trim().toUpperCase() || "LAIN-LAIN";
        const totalHarga = toNumber(item.total_harga);
        const view: InstruksiLapanganItemView = {
            jenis_pekerjaan: String(item.jenis_pekerjaan ?? "").trim() || "-",
            satuan: String(item.satuan ?? "").trim() || "-",
            volume: toNumber(item.volume),
            harga_material_formatted: rupiah(toNumber(item.harga_material)),
            harga_upah_formatted: rupiah(toNumber(item.harga_upah)),
            total_material_formatted: rupiah(toNumber(item.total_material)),
            total_upah_formatted: rupiah(toNumber(item.total_upah)),
            total_harga_formatted: rupiah(totalHarga),
        };

        if (!grouped.has(category)) {
            grouped.set(category, []);
            totals.set(category, 0);
        }
        grouped.get(category)!.push(view);
        totals.set(category, (totals.get(category) ?? 0) + totalHarga);
    }

    return Array.from(grouped.entries()).map(([category, groupedItems]) => ({
        category,
        items: groupedItems,
        summary: buildFinancialSummary(totals.get(category) ?? 0, "up", noPpn)
    }));
};

const buildRabGroupedItems = (items: RabItemRow[], noPpn = false): GroupedItems<RabItemView> => {
    const grouped = new Map<string, RabItemView[]>();
    const totals = new Map<string, number>();

    for (const item of items) {
        const category = String(item.kategori_pekerjaan ?? "").trim().toUpperCase() || "LAIN-LAIN";
        const totalHarga = toNumber(item.total_harga);
        const view: RabItemView = {
            jenis_pekerjaan: String(item.jenis_pekerjaan ?? "").trim() || "-",
            satuan: String(item.satuan ?? "").trim() || "-",
            volume_formatted: formatVolume(item.volume),
            harga_material_formatted: rupiah(toNumber(item.harga_material)),
            harga_upah_formatted: rupiah(toNumber(item.harga_upah)),
            total_material_formatted: rupiah(toNumber(item.total_material)),
            total_upah_formatted: rupiah(toNumber(item.total_upah)),
            total_harga_formatted: rupiah(totalHarga),
            catatan: item.catatan
        };

        if (!grouped.has(category)) {
            grouped.set(category, []);
            totals.set(category, 0);
        }
        grouped.get(category)!.push(view);
        totals.set(category, (totals.get(category) ?? 0) + totalHarga);
    }

    return Array.from(grouped.entries()).map(([category, groupedItems]) => ({
        category,
        items: groupedItems,
        summary: buildFinancialSummary(totals.get(category) ?? 0, "down", noPpn)
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
    const noPpn = isNoPpnArea(detail.toko);

    const grandTotalOpname = toNumber(detail.opname_final.grand_total_opname);
    const grandTotalRab = toNumber(detail.opname_final.grand_total_rab);
    const opnameItems = sortOpnameItemsByRabOrder(detail.items ?? []);
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
    const totalOpnameSelisih = sumOpnameTotalSelisih(opnameItems);
    const totalRabItems = sumRabTotalHarga(rabItems);
    const grandTotalIl = sumInstruksiLapanganTotalHarga(instruksiLapanganItems);
    const grandTotalKerjaTambah = sumOpnameTotalSelisih(kerjaTambahItems);
    const grandTotalKerjaKurang = sumOpnameTotalSelisih(kerjaKurangItems);
    const nilaiDenda = toNumber(detail.opname_final.nilai_denda);
    const hariDenda = Number(detail.opname_final.hari_denda ?? 0) || 0;
    const documentLabel = "Opname";
    const rabSummary = buildFinancialSummary(totalRabItems, "down", noPpn);
    const instruksiLapanganSummary = buildFinancialSummary(grandTotalIl, "up", noPpn);
    const kerjaTambahSummary = buildFinancialSummary(grandTotalKerjaTambah, "up", noPpn);
    const kerjaKurangSummary = buildFinancialSummary(grandTotalKerjaKurang, "up", noPpn);
    const selisihKerjaTambahKurang = kerjaTambahSummary.grand_total - Math.abs(kerjaKurangSummary.grand_total);
    const totalOpnameFinal = rabSummary.grand_total
        + instruksiLapanganSummary.grand_total
        + kerjaTambahSummary.grand_total
        - Math.abs(kerjaKurangSummary.grand_total)
        - nilaiDenda;

    const html = await renderHtmlTemplate(templatePath, {
        generated_at: formatDateIndonesia(new Date().toISOString()),
        opname_final: detail.opname_final,
        document_label: documentLabel,
        toko: detail.toko,
        header_left_logo_path: staticAssetPath("Alfamart-Emblem.png"),
        header_right_logo_path: staticAssetPath("Building-Logo.png"),
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
        grouped_items_list: await buildOpnameGroupedItems(opnameItems, noPpn),
        rab_grouped_items_list: buildRabGroupedItems(rabItems, noPpn),
        instruksi_lapangan_groups: buildInstruksiLapanganGroups(instruksiLapanganItems, noPpn),
        kerja_tambah_groups: await buildOpnameGroupedItems(kerjaTambahItems, noPpn),
        kerja_kurang_groups: await buildOpnameGroupedItems(kerjaKurangItems, noPpn),
        opname_summary: buildFinancialSummary(totalOpnameSelisih, "up", noPpn),
        rab_summary: rabSummary,
        instruksi_lapangan_summary: instruksiLapanganSummary,
        kerja_tambah_summary: kerjaTambahSummary,
        kerja_kurang_summary: kerjaKurangSummary,
        grand_total_opname_formatted: rupiah(grandTotalOpname),
        grand_total_rab_formatted: rupiah(grandTotalRab),
        selisih_total_formatted: rupiah(grandTotalOpname - grandTotalRab),
        grand_total_final_rab_formatted: rabSummary.grand_total_formatted,
        grand_total_il_formatted: instruksiLapanganSummary.grand_total_formatted,
        grand_total_kerja_tambah_formatted: kerjaTambahSummary.grand_total_formatted,
        grand_total_kerja_kurang_formatted: kerjaKurangSummary.grand_total_formatted,
        selisih_kerja_tambah_kurang_formatted: rupiah(selisihKerjaTambahKurang),
        hari_denda: hariDenda,
        nilai_denda_formatted: rupiah(nilaiDenda),
        tanggal_akhir_spk_denda_formatted: formatDateIndonesia(detail.opname_final.tanggal_akhir_spk_denda),
        tanggal_serah_terima_denda_formatted: formatDateIndonesia(detail.opname_final.tanggal_serah_terima_denda),
        total_opname_final_formatted: rupiah(totalOpnameFinal),
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
