import fs from "fs";
import path from "path";
import { resolveDriveImageDataUrl } from "../../common/drive-image";
import { renderHtmlTemplate, renderPdfFromHtml, resolveTemplatePath } from "../../common/html-pdf";
import type { SerahTerimaDetail } from "./serah-terima.repository";

const rupiah = (value: number): string => {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
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
        // Works for dev and build: src/modules/serah-terima -> src/image, dist/modules/serah-terima -> dist/image
        path.resolve(__dirname, "../../image", filename),
        // Build mode (dist): dist/modules/serah-terima -> src/image
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

const groupItemsByCategory = (items: SerahTerimaDetail["items"]) => {
    const groups: Array<{ category: string; items: SerahTerimaDetail["items"] }> = [];
    const indexByCategory = new Map<string, number>();

    for (const item of items) {
        const category = (item.kategori_pekerjaan ?? "").trim() || "Lainnya";
        const key = category.toLowerCase();
        const existingIndex = indexByCategory.get(key);

        if (existingIndex === undefined) {
            indexByCategory.set(key, groups.length);
            groups.push({ category, items: [item] });
            continue;
        }

        groups[existingIndex].items.push(item);
    }

    return groups;
};

const normalizeText = (value?: string | null): string => {
    return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
};

const countMatching = (
    items: SerahTerimaDetail["items"],
    selector: (item: SerahTerimaDetail["items"][number]) => string | null,
    expected: string
): number => {
    const normalizedExpected = normalizeText(expected);
    return items.filter((item) => normalizeText(selector(item)) === normalizedExpected).length;
};

export const calculateNilaiToko = (items: SerahTerimaDetail["items"]): number => {
    const total = items.length;
    const desainSesuai = countMatching(items, (item) => item.desain, "Sesuai");
    const kualitasBaik = countMatching(items, (item) => item.kualitas, "Baik");
    const spesifikasiSesuai = countMatching(items, (item) => item.spesifikasi, "Sesuai");
    const nilaiDesain = total > 0 ? (desainSesuai / total) * 30 : 0;
    const nilaiKualitas = total > 0 ? (kualitasBaik / total) * 35 : 0;
    const nilaiSpesifikasi = total > 0 ? (spesifikasiSesuai / total) * 35 : 0;
    return nilaiDesain + nilaiKualitas + nilaiSpesifikasi;
};

const buildAssessmentSummary = (items: SerahTerimaDetail["items"]) => {
    const total = items.length;
    const desainSesuai = countMatching(items, (item) => item.desain, "Sesuai");
    const kualitasBaik = countMatching(items, (item) => item.kualitas, "Baik");
    const spesifikasiSesuai = countMatching(items, (item) => item.spesifikasi, "Sesuai");
    const nilaiToko = calculateNilaiToko(items);

    return [
        {
            label: "Desain Sesuai",
            value: `${desainSesuai} dari ${total}`,
            detail: ""
        },
        {
            label: "Kualitas Baik",
            value: `${kualitasBaik} dari ${total}`,
            detail: ""
        },
        {
            label: "Spesifikasi Sesuai",
            value: `${spesifikasiSesuai} dari ${total}`,
            detail: ""
        },
        {
            label: "Nilai Toko",
            value: `${nilaiToko.toFixed(1)} / 100`,
            detail: ""
        },
    ];
};

export const buildSerahTerimaPdfBuffer = async (
    detail: SerahTerimaDetail,
    createdAt: string,
    options: { unifiedPartIndex?: number; unifiedPartTotal?: number } = {}
): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("serah_terima_report.njk");

    const grandTotalOpname = toNumber(detail.opname_final.grand_total_opname);
    const grandTotalRab = toNumber(detail.opname_final.grand_total_rab);
    const itemsWithPhotos = await Promise.all(detail.items.map(async (item) => ({
        ...item,
        foto_data_url: await resolveDriveImageDataUrl(item.foto),
        total_selisih_formatted: rupiah(item.total_selisih),
        total_harga_rab_formatted: rupiah(toNumber(item.total_harga_rab)),
        total_harga_opname_formatted: rupiah(item.total_harga_opname),
    })));

    const html = await renderHtmlTemplate(templatePath, {
        generated_at: formatDateIndonesia(createdAt),
        unified_part_index: options.unifiedPartIndex,
        unified_part_total: options.unifiedPartTotal,
        opname_final: detail.opname_final,
        toko: detail.toko,
        items: itemsWithPhotos,
        grouped_items_list: groupItemsByCategory(itemsWithPhotos).map((group) => ({
            category: group.category,
            items: group.items,
        })),
        assessment_summary: buildAssessmentSummary(detail.items),
        total_item_count: detail.items.length,
        grand_total_opname_formatted: rupiah(grandTotalOpname),
        grand_total_rab_formatted: rupiah(grandTotalRab),
        selisih_total_formatted: rupiah(grandTotalOpname - grandTotalRab),
        created_at_formatted: formatDateIndonesia(createdAt),
        watermark_logo_path: staticAssetPath("Building-Logo.png"),
    });

    return renderPdfFromHtml(html);
};

export const buildSerahTerimaUnifiedCoverPdfBuffer = async (input: {
    nomor_ulok: string;
    nama_toko?: string | null;
    cabang?: string | null;
    proyek?: string | null;
    created_at: string;
    scopes: Array<{
        lingkup_pekerjaan: string | null;
        kode_toko?: string | null;
        nama_kontraktor?: string | null;
        item_count: number;
        nilai_opname?: string | number | null;
    }>;
}): Promise<Buffer> => {
    const totalItems = input.scopes.reduce((sum, scope) => sum + Number(scope.item_count || 0), 0);
    const totalNilai = input.scopes.reduce((sum, scope) => sum + toNumber(scope.nilai_opname), 0);
    const rows = input.scopes.map((scope, index) => `
        <tr>
            <td class="center">${index + 1}</td>
            <td class="scope-name">${scope.lingkup_pekerjaan || "-"}</td>
            <td>${scope.kode_toko || "-"}</td>
            <td>${scope.nama_kontraktor || "-"}</td>
            <td class="center">${scope.item_count}</td>
            <td class="num">${rupiah(toNumber(scope.nilai_opname))}</td>
        </tr>
    `).join("");

    const templatePath = await resolveTemplatePath("serah_terima_unified_cover.njk");
    const coverHtml = await renderHtmlTemplate(templatePath, {
        nomor_ulok: input.nomor_ulok,
        nama_toko: input.nama_toko ?? "-",
        created_at_formatted: formatDateIndonesia(input.created_at),
        scope_count: input.scopes.length,
        total_items: totalItems,
        total_nilai_formatted: rupiah(totalNilai),
        scope_order: input.scopes.map((scope) => scope.lingkup_pekerjaan || "-").join(" lalu "),
        scopes: input.scopes.map((scope) => ({
            ...scope,
            nilai_opname_formatted: rupiah(toNumber(scope.nilai_opname)),
        })),
    });
    return renderPdfFromHtml(coverHtml);
};

export const buildSerahTerimaUnifiedSummaryPdfBuffer = async (input: {
    nomor_ulok: string;
    nama_toko?: string | null;
    created_at: string;
    scopes: Array<{
        lingkup_pekerjaan: string | null;
        nilai_toko: number;
    }>;
    average_nilai_toko: number;
}): Promise<Buffer> => {
    const templatePath = await resolveTemplatePath("serah_terima_unified_summary.njk");
    const summaryHtml = await renderHtmlTemplate(templatePath, {
        nomor_ulok: input.nomor_ulok,
        nama_toko: input.nama_toko ?? "-",
        created_at_formatted: formatDateIndonesia(input.created_at),
        scopes: input.scopes.map(s => ({
            ...s,
            nilai_toko_formatted: s.nilai_toko.toFixed(1)
        })),
        average_nilai_toko_formatted: input.average_nilai_toko.toFixed(1),
    });
    return renderPdfFromHtml(summaryHtml);
}
