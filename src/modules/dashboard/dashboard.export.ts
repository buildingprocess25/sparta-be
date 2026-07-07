import * as XLSX from "xlsx";
import { AppError } from "../../common/app-error";
import { isSameBranchScope } from "../../common/branch-scope";
import { renderPdfFromHtml } from "../../common/html-pdf";
import { calculateDendaNominal, isHeadOfficeCabang } from "../denda/denda-keterlambatan";
import type { DashboardData } from "./dashboard.repository";
import type { DashboardExportQueryInput } from "./dashboard.schema";

export type DashboardExportColumn = {
    key: string;
    label: string;
};

export type DashboardExportRow = {
    timestamp: string;
    cabang: string;
    nomor_ulok: string;
    status_rab: string;
    proyek: string;
    lingkup_pekerjaan: string;
    kontraktor: string;
    nama_toko: string;
    kode_toko: string;
    luas_bangunan: string;
    luas_terbangunan: string;
    luas_area_terbuka: string;
    luas_area_parkir: string;
    luas_area_sales: string;
    luas_gudang: string;
    pekerjaan_area_terbuka: number;
    pekerjaan_beanspot: number;
    total_penawaran_final: number;
    kategori: string;
    timestamp_acc_manager: string;
    pic: string;
    status: string;
    timestamp_spk: string;
    durasi_spk: string | number;
    nominal_spk: number;
    awal_spk: string;
    akhir_spk: string;
    tambah_spk: string;
    akhir_spk_setelah: string;
    real_spk: number;
    tanggal_serah_terima: string;
    keterlambatan: number;
    denda: number;
    tanggal_grand_opening: string;
    kerja_tambah: number;
    kerja_kurang: number;
    grand_total_opname_final: number;
    tanggal_opname_final: string;
    status_opname_final: string;
    nilai_toko: number;
    _work_items?: string[];
    _job_items?: DashboardJobItemExportRow[];
};

export type DashboardJobItemExportRow = {
    sumber: string;
    cabang: string;
    nomor_ulok: string;
    nama_toko: string;
    kode_toko: string;
    lingkup_pekerjaan: string;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: string | number;
    harga_material: number;
    harga_upah: number;
    total_material: number;
    total_upah: number;
    total_harga: number;
    status: string;
    catatan: string;
    tanggal: string;
};

export const dashboardExportColumns: DashboardExportColumn[] = [
    { key: "timestamp", label: "Timestamp" },
    { key: "cabang", label: "Cabang" },
    { key: "nomor_ulok", label: "Nomor Ulok" },
    { key: "status_rab", label: "Status_Rab" },
    { key: "proyek", label: "Proyek" },
    { key: "lingkup_pekerjaan", label: "Lingkup_Pekerjaan" },
    { key: "kontraktor", label: "Kontraktor" },
    { key: "nama_toko", label: "Nama_Toko" },
    { key: "kode_toko", label: "Kode_Toko" },
    { key: "luas_bangunan", label: "Luas Bangunan" },
    { key: "luas_terbangunan", label: "Luas Terbangunan" },
    { key: "luas_area_terbuka", label: "Luas Area Terbuka" },
    { key: "luas_area_parkir", label: "Luas Area Parkir" },
    { key: "luas_area_sales", label: "Luas Area Sales" },
    { key: "luas_gudang", label: "Luas Gudang" },
    { key: "pekerjaan_area_terbuka", label: "Pekerjaan Area Terbuka" },
    { key: "pekerjaan_beanspot", label: "Pekerjaan Beanspot" },
    { key: "total_penawaran_final", label: "Total Penawaran Final" },
    { key: "kategori", label: "Kategori" },
    { key: "timestamp_acc_manager", label: "TIMESTAMP ACC MANAGER" },
    { key: "pic", label: "PIC" },
    { key: "status", label: "Status" },
    { key: "timestamp_spk", label: "TimeSTAMP SPK" },
    { key: "durasi_spk", label: "Durasi SPK" },
    { key: "nominal_spk", label: "Nominal SPK" },
    { key: "awal_spk", label: "Awal_SPK" },
    { key: "akhir_spk", label: "Akhir_SPK" },
    { key: "tambah_spk", label: "tambah_spk" },
    { key: "akhir_spk_setelah", label: "Akhir_SPK_Setelah" },
    { key: "real_spk", label: "Real SPK" },
    { key: "tanggal_serah_terima", label: "tanggal_serah_terima" },
    { key: "keterlambatan", label: "Keterlambatan" },
    { key: "denda", label: "Denda" },
    { key: "tanggal_grand_opening", label: "Tanggal Grand Opening" },
    { key: "kerja_tambah", label: "Kerja_Tambah" },
    { key: "kerja_kurang", label: "Kerja_Kurang" },
    { key: "grand_total_opname_final", label: "Grand Total Opname Final" },
    { key: "tanggal_opname_final", label: "tanggal_opname_final" },
    { key: "status_opname_final", label: "Status Opname Final" },
    { key: "nilai_toko", label: "Nilai Toko" }
];

const normalize = (value: unknown) => String(value ?? "").trim();
const normalizeUpper = (value: unknown) => normalize(value).toUpperCase();

const toNumber = (value: unknown): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = normalize(value);
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toDate = (value: unknown): Date | null => {
    const raw = normalize(value);
    if (!raw) return null;
    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
        const [, day, month, year] = slash;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (value: unknown): string => {
    const date = toDate(value);
    if (!date) return "";
    return date.toISOString().slice(0, 10);
};

const formatDateTime = (value: unknown): string => {
    const date = toDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta"
    }).format(date);
};

const formatDateLong = (value: unknown): string => {
    const date = toDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta"
    }).format(date);
};

const formatMoney = (value: unknown): string =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(toNumber(value));

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

const nextBusinessDayAfter = (date: Date): Date => {
    let current = addDays(date, 1);
    while (isWeekend(current)) current = addDays(current, 1);
    return current;
};

const countWeekdaysAfter = (freeDate: Date, compareDate: Date): number => {
    if (compareDate <= freeDate) return 0;
    let current = addDays(freeDate, 1);
    let count = 0;
    while (current <= compareDate) {
        if (!isWeekend(current)) count += 1;
        current = addDays(current, 1);
    }
    return count;
};

const calculatePenalty = (lateDays: number): number => {
    return calculateDendaNominal(lateDays);
};

const roundDownTenThousand = (value: number): number => {
    const sign = value < 0 ? -1 : 1;
    return sign * Math.floor(Math.abs(value) / 10000) * 10000;
};

const roundUpTenThousand = (value: number): number => {
    if (value === 0) return 0;
    const sign = value < 0 ? -1 : 1;
    return sign * Math.ceil(Math.abs(value) / 10000) * 10000;
};

const isNoPpnArea = (project: DashboardData): boolean => {
    const values = [
        project.toko.cabang,
        project.toko.nama_toko,
        project.toko.alamat
    ].map((value) => normalizeUpper(value));

    return values.some((value) => value === "BATAM" || value === "BINTAN" || /\bBATAM\b|\bBINTAN\b/.test(value));
};

const buildFinancialGrandTotal = (total: number, direction: "down" | "up", noPpn = false): number => {
    const pembulatan = direction === "down"
        ? roundDownTenThousand(total)
        : roundUpTenThousand(total);
    const ppn = noPpn ? 0 : Math.round(pembulatan * 0.11);
    return pembulatan + ppn;
};

const latestByDate = <T>(items: T[], picker: (item: T) => unknown): T | null => {
    if (items.length === 0) return null;
    return [...items].sort((a, b) => (toDate(picker(b))?.getTime() ?? 0) - (toDate(picker(a))?.getTime() ?? 0))[0] ?? null;
};

const isApprovedSpk = (status: unknown): boolean => {
    const normalized = normalizeUpper(status);
    return ["APPROVED", "ACTIVE", "SPK_APPROVED", "DISETUJUI", "AKTIF", "SELESAI"].includes(normalized);
};

const isApprovedExtension = (status: unknown): boolean => {
    const normalized = normalizeUpper(status);
    return normalized === "APPROVED" || normalized.includes("DISETUJUI");
};

const isAreaTerbuka = (item: { kategori_pekerjaan?: string | null; jenis_pekerjaan?: string | null; rab_item?: unknown }) => {
    const rabItem = item.rab_item && typeof item.rab_item === "object" ? item.rab_item as Record<string, unknown> : {};
    const text = `${item.kategori_pekerjaan ?? rabItem.kategori_pekerjaan ?? ""} ${item.jenis_pekerjaan ?? rabItem.jenis_pekerjaan ?? ""}`;
    return normalizeUpper(text).includes("AREA TERBUKA");
};

const isBeanspot = (item: { kategori_pekerjaan?: string | null; jenis_pekerjaan?: string | null; rab_item?: unknown }) => {
    const rabItem = item.rab_item && typeof item.rab_item === "object" ? item.rab_item as Record<string, unknown> : {};
    const text = `${item.kategori_pekerjaan ?? rabItem.kategori_pekerjaan ?? ""} ${item.jenis_pekerjaan ?? rabItem.jenis_pekerjaan ?? ""}`;
    return normalizeUpper(text).includes("BEANSPOT");
};

const sumBy = <T>(items: T[], predicate: (item: T) => boolean, picker: (item: T) => unknown): number =>
    items.reduce((total, item) => total + (predicate(item) ? toNumber(picker(item)) : 0), 0);

const findTanggalGo = (
    project: DashboardData,
    dokumentasiByKey: Map<string, { tanggal_go: string | null; created_at: string | null }>
) => {
    const candidates = [
        `kode:${normalizeUpper(project.toko.kode_toko)}`,
        `ulok:${normalizeUpper(project.toko.nomor_ulok)}`,
        `toko:${normalizeUpper(project.toko.cabang)}|${normalizeUpper(project.toko.nama_toko)}`
    ];
    for (const key of candidates) {
        const row = dokumentasiByKey.get(key);
        if (row?.tanggal_go) return row.tanggal_go;
    }
    return "";
};

const parseSelectedTokoIds = (value?: string): Set<number> => {
    const ids = String(value ?? "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
    return new Set(ids);
};
const parseCsvSet = (value?: string): Set<string> => new Set(
    String(value ?? "")
        .split(",")
        .map((item) => normalizeUpper(item))
        .filter(Boolean)
);

const parseMonthSet = (value?: string): Set<number> => new Set(
    String(value ?? "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
);

const getProjectDates = (project: DashboardData): Date[] => [
    ...project.rab.map((item) => item.created_at),
    ...project.spk.map((item) => item.created_at),
    ...project.opname_final.map((item) => item.created_at),
    ...project.berkas_serah_terima.map((item) => item.created_at)
]
    .map(toDate)
    .filter((date): date is Date => Boolean(date));

const matchesPeriodFilter = (project: DashboardData, query: DashboardExportQueryInput): boolean => {
    if (query.period_mode === "all") return true;
    const year = query.year ?? new Date().getFullYear();
    const months = parseMonthSet(query.months);
    const dates = getProjectDates(project);
    if (dates.length === 0) return false;

    if (query.period_mode === "ytd") {
        const now = new Date();
        return dates.some((date) => date.getFullYear() === year && date <= now);
    }

    if (months.size === 0) return true;
    return dates.some((date) => date.getFullYear() === year && months.has(date.getMonth() + 1));
};

const hasSpk = (project: DashboardData): boolean => project.spk.length > 0;

const collectProjectWorkItems = (project: DashboardData): Set<string> => {
    const values: string[] = [];

    project.rab.forEach((rab) => rab.items.forEach((item) => {
        values.push(normalizeUpper(item.kategori_pekerjaan || item.jenis_pekerjaan));
    }));

    project.opname_final.forEach((opname) => opname.items.forEach((item) => {
        values.push(normalizeUpper(item.kategori_pekerjaan || item.jenis_pekerjaan));
    }));

    project.instruksi_lapangan.forEach((instruksi) => instruksi.items.forEach((item) => {
        values.push(normalizeUpper(item.kategori_pekerjaan || item.jenis_pekerjaan));
    }));

    project.gantt.forEach((gantt) => {
        gantt.kategori_pekerjaan.forEach((item) => values.push(normalizeUpper(item.kategori_pekerjaan)));
        gantt.pengawasan.forEach((item) => values.push(normalizeUpper(item.kategori_pekerjaan || item.jenis_pekerjaan)));
    });

    return new Set(values.filter(Boolean));
};

const buildJobItemBase = (project: DashboardData, source: string) => ({
    sumber: source,
    cabang: normalize(project.toko.cabang),
    nomor_ulok: normalize(project.toko.nomor_ulok),
    nama_toko: normalize(project.toko.nama_toko),
    kode_toko: normalize(project.toko.kode_toko),
    lingkup_pekerjaan: normalize(project.toko.lingkup_pekerjaan)
});

const collectProjectJobItems = (project: DashboardData): DashboardJobItemExportRow[] => {
    const rows: DashboardJobItemExportRow[] = [];

    project.rab.forEach((rab) => rab.items.forEach((item) => {
        rows.push({
            ...buildJobItemBase(project, "RAB"),
            kategori_pekerjaan: normalize(item.kategori_pekerjaan),
            jenis_pekerjaan: normalize(item.jenis_pekerjaan),
            satuan: normalize(item.satuan),
            volume: normalize(item.volume),
            harga_material: toNumber(item.harga_material),
            harga_upah: toNumber(item.harga_upah),
            total_material: toNumber(item.total_material),
            total_upah: toNumber(item.total_upah),
            total_harga: toNumber(item.total_harga),
            status: normalize(rab.status),
            catatan: normalize(item.catatan),
            tanggal: toIsoDate(rab.created_at)
        });
    }));

    project.instruksi_lapangan.forEach((instruksi) => instruksi.items.forEach((item) => {
        rows.push({
            ...buildJobItemBase(project, "Instruksi Lapangan"),
            kategori_pekerjaan: normalize(item.kategori_pekerjaan),
            jenis_pekerjaan: normalize(item.jenis_pekerjaan),
            satuan: normalize(item.satuan),
            volume: item.volume ?? "",
            harga_material: toNumber(item.harga_material),
            harga_upah: toNumber(item.harga_upah),
            total_material: toNumber(item.total_material),
            total_upah: toNumber(item.total_upah),
            total_harga: toNumber(item.total_harga),
            status: normalize(instruksi.status),
            catatan: "",
            tanggal: toIsoDate(instruksi.created_at)
        });
    }));

    project.opname_final.forEach((opname) => opname.items.forEach((item) => {
        rows.push({
            ...buildJobItemBase(project, "Opname Final"),
            kategori_pekerjaan: normalize(item.kategori_pekerjaan),
            jenis_pekerjaan: normalize(item.jenis_pekerjaan),
            satuan: normalize(item.satuan),
            volume: item.volume_akhir ?? "",
            harga_material: 0,
            harga_upah: 0,
            total_material: 0,
            total_upah: 0,
            total_harga: toNumber(item.total_harga_opname),
            status: normalize(item.status || opname.status_opname_final),
            catatan: normalize(item.catatan),
            tanggal: toIsoDate(item.created_at ?? opname.created_at)
        });
    }));

    project.gantt.forEach((gantt) => {
        gantt.kategori_pekerjaan.forEach((item) => {
            rows.push({
                ...buildJobItemBase(project, "Gantt"),
                kategori_pekerjaan: normalize(item.kategori_pekerjaan),
                jenis_pekerjaan: "",
                satuan: "",
                volume: "",
                harga_material: 0,
                harga_upah: 0,
                total_material: 0,
                total_upah: 0,
                total_harga: 0,
                status: normalize(gantt.status),
                catatan: "",
                tanggal: toIsoDate(gantt.timestamp)
            });
        });

        gantt.pengawasan.forEach((item) => {
            rows.push({
                ...buildJobItemBase(project, "Pengawasan"),
                kategori_pekerjaan: normalize(item.kategori_pekerjaan),
                jenis_pekerjaan: normalize(item.jenis_pekerjaan),
                satuan: "",
                volume: "",
                harga_material: 0,
                harga_upah: 0,
                total_material: 0,
                total_upah: 0,
                total_harga: 0,
                status: normalize(item.status),
                catatan: normalize(item.catatan),
                tanggal: toIsoDate(item.created_at)
            });
        });
    });

    return rows.filter((row) => normalize(row.kategori_pekerjaan || row.jenis_pekerjaan));
};

const dataTypeColumns: Record<string, Array<keyof DashboardExportRow>> = {
    IDENTITAS: ["timestamp", "cabang", "nomor_ulok", "proyek", "lingkup_pekerjaan", "kontraktor", "nama_toko", "kode_toko", "kategori", "pic", "status"],
    RAB: ["status_rab", "luas_bangunan", "luas_terbangunan", "luas_area_terbuka", "luas_area_parkir", "luas_area_sales", "luas_gudang", "pekerjaan_area_terbuka", "pekerjaan_beanspot", "total_penawaran_final", "timestamp_acc_manager", "tanggal_grand_opening"],
    SPK: ["timestamp_spk", "durasi_spk", "nominal_spk", "awal_spk", "akhir_spk", "tambah_spk", "akhir_spk_setelah", "real_spk"],
    OPNAME: ["tanggal_serah_terima", "keterlambatan", "denda", "kerja_tambah", "kerja_kurang", "grand_total_opname_final", "tanggal_opname_final", "status_opname_final", "nilai_toko"]
};

const jobItemExportColumns: DashboardExportColumn[] = [
    { key: "sumber", label: "Sumber" },
    { key: "cabang", label: "Cabang" },
    { key: "nomor_ulok", label: "Nomor ULOK" },
    { key: "nama_toko", label: "Nama Toko" },
    { key: "kode_toko", label: "Kode Toko" },
    { key: "lingkup_pekerjaan", label: "Lingkup Pekerjaan" },
    { key: "kategori_pekerjaan", label: "Kategori Pekerjaan" },
    { key: "jenis_pekerjaan", label: "Jenis Pekerjaan" },
    { key: "satuan", label: "Satuan" },
    { key: "volume", label: "Volume" },
    { key: "harga_material", label: "Harga Material" },
    { key: "harga_upah", label: "Harga Upah" },
    { key: "total_material", label: "Total Material" },
    { key: "total_upah", label: "Total Upah" },
    { key: "total_harga", label: "Total Harga" },
    { key: "status", label: "Status" },
    { key: "catatan", label: "Catatan" },
    { key: "tanggal", label: "Tanggal" }
];

const dataTypeLabels: Record<string, string> = {
    IDENTITAS: "Identitas Toko",
    RAB: "RAB & Luasan",
    SPK: "SPK",
    OPNAME: "Opname & Denda"
};

const addJobTypeColumns = (keys: Set<keyof DashboardExportRow>, jobTypes?: string) => {
    const selectedJobTypes = parseCsvSet(jobTypes);
    selectedJobTypes.forEach((type) => {
        if (type.includes("AREA TERBUKA")) keys.add("pekerjaan_area_terbuka");
        if (type.includes("BEANSPOT")) keys.add("pekerjaan_beanspot");
    });
};

const resolveDashboardExportColumns = (dataTypes?: string, jobTypes?: string): DashboardExportColumn[] => {
    const selected = parseCsvSet(dataTypes);
    if (selected.size === 0) return dashboardExportColumns;
    const keys = new Set<keyof DashboardExportRow>();
    selected.forEach((type) => dataTypeColumns[type]?.forEach((key) => keys.add(key)));
    addJobTypeColumns(keys, jobTypes);
    if (keys.size === 0) return dashboardExportColumns;
    return dashboardExportColumns.filter((column) => keys.has(column.key as keyof DashboardExportRow));
};

const resolveDataTypeColumns = (dataType: string): DashboardExportColumn[] => {
    const keys = new Set(dataTypeColumns[dataType] ?? []);
    if (keys.size === 0) return dashboardExportColumns;
    return dashboardExportColumns.filter((column) => keys.has(column.key as keyof DashboardExportRow));
};

const normalizeSheetName = (value: string, fallback: string): string => {
    const cleaned = normalize(value)
        .replace(/[\\/?*[\]:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return (cleaned || fallback).slice(0, 31);
};

const normalizeFilePart = (value: string, fallback: string): string => {
    const cleaned = normalizeUpper(value)
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return cleaned || fallback;
};

type DashboardExportSection = {
    title: string;
    filenamePart: string;
    rows: Array<Record<string, unknown>>;
    columns: DashboardExportColumn[];
};

const displayValue = (value: unknown): unknown => {
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value;
    return normalize(value) || "Tidak ada";
};

const rowMatchesJobType = (row: DashboardExportRow, jobType: string): boolean => {
    const type = normalizeUpper(jobType);
    if (!type) return true;
    if (row._work_items?.length) return row._work_items.includes(type);
    if (type.includes("AREA TERBUKA")) return toNumber(row.pekerjaan_area_terbuka) !== 0;
    if (type.includes("BEANSPOT")) return toNumber(row.pekerjaan_beanspot) !== 0;
    return true;
};

const jobItemMatchesJobType = (row: DashboardJobItemExportRow, jobType: string): boolean => {
    const type = normalizeUpper(jobType);
    return normalizeUpper(row.kategori_pekerjaan || row.jenis_pekerjaan) === type;
};

const uniqueJoined = (values: unknown[], separator = "\n"): string => {
    const unique = Array.from(new Set(values.map((value) => normalize(value)).filter(Boolean)));
    return unique.length > 0 ? unique.join(separator) : "";
};

const sumValues = (values: unknown[]): number => values.reduce<number>((total, value) => total + toNumber(value), 0);

const aggregateJobItemsByUlok = (items: DashboardJobItemExportRow[]): DashboardJobItemExportRow[] => {
    const groups = new Map<string, DashboardJobItemExportRow[]>();
    items.forEach((item) => {
        const key = [
            normalizeUpper(item.cabang),
            normalizeUpper(item.nomor_ulok),
            normalizeUpper(item.nama_toko),
            normalizeUpper(item.kode_toko),
            normalizeUpper(item.lingkup_pekerjaan),
            normalizeUpper(item.kategori_pekerjaan)
        ].join("|");
        const rows = groups.get(key) ?? [];
        rows.push(item);
        groups.set(key, rows);
    });

    return [...groups.values()].map((rows) => {
        const first = rows[0];
        return {
            sumber: uniqueJoined(rows.map((row) => row.sumber), ", "),
            cabang: first.cabang,
            nomor_ulok: first.nomor_ulok,
            nama_toko: first.nama_toko,
            kode_toko: first.kode_toko,
            lingkup_pekerjaan: first.lingkup_pekerjaan,
            kategori_pekerjaan: first.kategori_pekerjaan,
            jenis_pekerjaan: uniqueJoined(rows.map((row) => row.jenis_pekerjaan)),
            satuan: uniqueJoined(rows.map((row) => row.satuan)),
            volume: uniqueJoined(rows.map((row) => row.volume)),
            harga_material: sumValues(rows.map((row) => row.harga_material)),
            harga_upah: sumValues(rows.map((row) => row.harga_upah)),
            total_material: sumValues(rows.map((row) => row.total_material)),
            total_upah: sumValues(rows.map((row) => row.total_upah)),
            total_harga: sumValues(rows.map((row) => row.total_harga)),
            status: uniqueJoined(rows.map((row) => row.status), ", "),
            catatan: uniqueJoined(rows.map((row) => row.catatan)),
            tanggal: uniqueJoined(rows.map((row) => row.tanggal), ", ")
        };
    });
};

const buildDashboardExportSections = (
    rows: DashboardExportRow[],
    dataTypes?: string,
    jobTypes?: string
): DashboardExportSection[] => {
    const selectedDataTypes = [...parseCsvSet(dataTypes)];
    const selectedJobTypes = [...parseCsvSet(jobTypes)];
    const sections: DashboardExportSection[] = [];

    selectedDataTypes.forEach((type) => {
        sections.push({
            title: dataTypeLabels[type] ?? type,
            filenamePart: `jenis_data_${normalizeFilePart(dataTypeLabels[type] ?? type, type)}`,
            rows,
            columns: resolveDataTypeColumns(type)
        });
    });

    selectedJobTypes.forEach((jobType) => {
        const jobRows = rows
            .filter((row) => rowMatchesJobType(row, jobType))
            .flatMap((row) => row._job_items ?? [])
            .filter((row) => jobItemMatchesJobType(row, jobType));
        sections.push({
            title: jobType,
            filenamePart: `pekerjaan_${normalizeFilePart(jobType, "ITEM")}`,
            rows: aggregateJobItemsByUlok(jobRows),
            columns: jobItemExportColumns
        });
    });

    if (sections.length === 0) {
        sections.push({
            title: "Dashboard Export",
            filenamePart: "dashboard_export",
            rows,
            columns: dashboardExportColumns
        });
    }

    return sections;
};

const htmlEscape = (value: unknown): string => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const filterDashboardExportAccess = (projects: DashboardData[], query: DashboardExportQueryInput): DashboardData[] => {
    const actorRole = normalizeUpper(query.actor_role);
    const actorCabang = normalizeUpper(query.actor_cabang);

    if (actorRole.includes("KONTRAKTOR")) {
        throw new AppError("Role kontraktor tidak diizinkan mengunduh export dashboard", 403);
    }

    const cabangFilter = normalizeUpper(query.cabang);
    const selectedCabangs = parseCsvSet(query.cabangs);
    const selectedJobTypes = parseCsvSet(query.job_types);
    const selectedTokoIds = parseSelectedTokoIds(query.toko_ids);
    return projects.filter((project) => {
        const projectCabang = normalizeUpper(project.toko.cabang);
        const projectWorkItems = collectProjectWorkItems(project);
        if (isHeadOfficeCabang(projectCabang)) return false;
        if (actorCabang !== "HEAD OFFICE" && !isSameBranchScope(projectCabang, actorCabang)) return false;
        if (cabangFilter && cabangFilter !== "ALL" && projectCabang !== cabangFilter) return false;
        if (selectedCabangs.size > 0 && !selectedCabangs.has(projectCabang)) return false;
        if (selectedJobTypes.size > 0 && ![...selectedJobTypes].some((item) => projectWorkItems.has(item))) return false;
        if (selectedTokoIds.size > 0 && !selectedTokoIds.has(Number(project.toko.id))) return false;
        if (query.spk_status === "with_spk" && !hasSpk(project)) return false;
        if (query.spk_status === "without_spk" && hasSpk(project)) return false;
        if (!matchesPeriodFilter(project, query)) return false;
        return true;
    });
};

export const buildDokumentasiIndex = (rows: Array<{
    nomor_ulok: string | null;
    nama_toko: string | null;
    kode_toko: string | null;
    cabang: string | null;
    tanggal_go: string | null;
    created_at: string | null;
}>) => {
    const index = new Map<string, { tanggal_go: string | null; created_at: string | null }>();
    const setLatest = (key: string, row: { tanggal_go: string | null; created_at: string | null }) => {
        if (!key.endsWith(":") && !key.includes(":|")) {
            const existing = index.get(key);
            const existingTime = toDate(existing?.created_at)?.getTime() ?? 0;
            const rowTime = toDate(row.created_at)?.getTime() ?? 0;
            if (!existing || rowTime >= existingTime) index.set(key, row);
        }
    };

    for (const row of rows) {
        setLatest(`kode:${normalizeUpper(row.kode_toko)}`, row);
        setLatest(`ulok:${normalizeUpper(row.nomor_ulok)}`, row);
        setLatest(`toko:${normalizeUpper(row.cabang)}|${normalizeUpper(row.nama_toko)}`, row);
    }

    return index;
};

export const buildDashboardExportRows = (
    projects: DashboardData[],
    dokumentasiByKey: Map<string, { tanggal_go: string | null; created_at: string | null }>
): DashboardExportRow[] => {
    return projects.map((project) => {
        const rab = latestByDate(project.rab, (item) => item.created_at);
        const approvedSpks = project.spk.filter((item) => isApprovedSpk(item.status));
        const spk = latestByDate(approvedSpks.length > 0 ? approvedSpks : project.spk, (item) => item.created_at);
        const latestExtension = spk ? latestByDate(
            spk.pertambahan_spk.filter((item) => isApprovedExtension(item.status_persetujuan)),
            (item) => item.created_at
        ) : null;
        const finalOpnames = project.opname_final.filter((item) => normalizeUpper(item.tipe_opname) === "OPNAME_FINAL");
        const opname = latestByDate(finalOpnames, (item) => item.created_at);
        const st = latestByDate(project.berkas_serah_terima, (item) => item.created_at);
        const items = opname?.items ?? [];

        const totalPenawaran = toNumber(rab?.grand_total_final ?? rab?.grand_total ?? 0);
        const noPpn = isNoPpnArea(project);
        const kerjaTambahRaw = sumBy(items, (item) => toNumber(item.total_selisih) > 0, (item) => item.total_selisih);
        const kerjaKurangRaw = sumBy(items, (item) => toNumber(item.total_selisih) < 0, (item) => item.total_selisih);
        const kerjaTambah = buildFinancialGrandTotal(kerjaTambahRaw, "up", noPpn);
        const kerjaKurang = Math.abs(buildFinancialGrandTotal(kerjaKurangRaw, "up", noPpn));
        const areaTerbuka = sumBy(items, isAreaTerbuka, (item) => item.total_harga_opname);
        const beanspot = sumBy(items, isBeanspot, (item) => item.total_harga_opname);
        const grandTotalOpname = opname ? totalPenawaran + kerjaTambah - kerjaKurang : 0;
        const spkEndDate = toDate(latestExtension?.tanggal_spk_akhir_setelah_perpanjangan) ?? toDate(spk?.waktu_selesai);
        const realSpk = Math.max(0, toNumber(spk?.durasi) + toNumber(latestExtension?.pertambahan_hari));
        const stDate = toDate(st?.created_at ?? opname?.tanggal_serah_terima_denda);
        const lateDaysFromDb = Number(opname?.hari_denda ?? NaN);
        const lateDays = Number.isFinite(lateDaysFromDb) && (opname?.tanggal_akhir_spk_denda || opname?.tanggal_serah_terima_denda)
            ? Math.max(0, lateDaysFromDb)
            : (spkEndDate && stDate ? countWeekdaysAfter(nextBusinessDayAfter(spkEndDate), stDate) : 0);
        const penalty = toNumber(opname?.nilai_denda) || calculatePenalty(lateDays);

        const row: DashboardExportRow = {
            timestamp: formatDateTime(rab?.created_at),
            cabang: normalize(project.toko.cabang),
            nomor_ulok: normalize(project.toko.nomor_ulok),
            status_rab: normalize(rab?.status),
            proyek: normalize(project.toko.proyek ?? spk?.proyek),
            lingkup_pekerjaan: normalize(project.toko.lingkup_pekerjaan ?? spk?.lingkup_pekerjaan),
            kontraktor: normalize(spk?.nama_kontraktor ?? rab?.nama_pt ?? project.toko.nama_kontraktor),
            nama_toko: normalize(project.toko.nama_toko),
            kode_toko: normalize(project.toko.kode_toko),
            luas_bangunan: normalize(rab?.luas_bangunan),
            luas_terbangunan: normalize(rab?.luas_terbangun),
            luas_area_terbuka: normalize(rab?.luas_area_terbuka),
            luas_area_parkir: normalize(rab?.luas_area_parkir),
            luas_area_sales: normalize(rab?.luas_area_sales),
            luas_gudang: normalize(rab?.luas_gudang),
            pekerjaan_area_terbuka: areaTerbuka,
            pekerjaan_beanspot: beanspot,
            total_penawaran_final: totalPenawaran,
            kategori: normalize(rab?.kategori_lokasi ?? project.pic_pengawasan?.kategori_lokasi),
            timestamp_acc_manager: formatDateTime(rab?.waktu_persetujuan_manager),
            pic: normalize(project.pic_pengawasan?.plc_building_support),
            status: "",
            timestamp_spk: formatDateTime(spk?.created_at),
            durasi_spk: spk?.durasi ?? "",
            nominal_spk: toNumber(spk?.grand_total),
            awal_spk: toIsoDate(spk?.waktu_mulai),
            akhir_spk: toIsoDate(spk?.waktu_selesai),
            tambah_spk: normalize(latestExtension?.pertambahan_hari),
            akhir_spk_setelah: toIsoDate(latestExtension?.tanggal_spk_akhir_setelah_perpanjangan),
            real_spk: realSpk,
            tanggal_serah_terima: toIsoDate(st?.created_at ?? opname?.tanggal_serah_terima_denda),
            keterlambatan: lateDays,
            denda: penalty,
            tanggal_grand_opening: toIsoDate(findTanggalGo(project, dokumentasiByKey)),
            kerja_tambah: kerjaTambah,
            kerja_kurang: kerjaKurang,
            grand_total_opname_final: grandTotalOpname,
            tanggal_opname_final: toIsoDate(opname?.created_at),
            status_opname_final: normalize(opname?.status_opname_final),
            nilai_toko: grandTotalOpname,
            _work_items: [...collectProjectWorkItems(project)],
            _job_items: collectProjectJobItems(project)
        };

        const requiredKeys: Array<keyof DashboardExportRow> = [
            "timestamp",
            "cabang",
            "nomor_ulok",
            "status_rab",
            "proyek",
            "lingkup_pekerjaan",
            "kontraktor",
            "nama_toko",
            "kode_toko",
            "total_penawaran_final",
            "nominal_spk",
            "awal_spk",
            "akhir_spk",
            "tanggal_serah_terima",
            "grand_total_opname_final",
            "status_opname_final"
        ];
        const numericRequiredKeys = new Set<keyof DashboardExportRow>([
            "total_penawaran_final",
            "nominal_spk",
            "grand_total_opname_final"
        ]);
        row.status = requiredKeys.every((key) => {
            const value = row[key];
            if (numericRequiredKeys.has(key)) return toNumber(value) !== 0;
            return normalize(value) !== "";
        }) ? "done" : "progress";

        return row;
    });
};

const rowsToAoA = (rows: Array<Record<string, unknown>>, columns: DashboardExportColumn[]) => [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => displayValue(row[column.key])))
];

const applyWorksheetFormatting = (
    worksheet: XLSX.WorkSheet,
    rows: Array<Record<string, unknown>>,
    columns: DashboardExportColumn[]
) => {
    const colWidths = columns.map((column) => {
        const headerLen = column.label.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
        let maxDataLen = headerLen;
        for (const row of rows) {
            const val = String(row[column.key] || "");
            maxDataLen = Math.max(maxDataLen, val.length);
        }
        return { wch: Math.min(Math.max(maxDataLen + 2, 12), 40) };
    });
    worksheet["!cols"] = colWidths;

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
            const cell = worksheet[cellRef];
            if (!cell || cell.t !== "n") continue;

            const colKey = columns[C]?.key;
            if (colKey && (colKey.includes("nominal") || colKey.includes("penawaran") || colKey.includes("denda") || colKey.includes("kerja_") || colKey.includes("total_") || colKey.includes("nilai_") || colKey.includes("pekerjaan_"))) {
                cell.z = "#,##0";
            }
        }
    }
};

const appendDashboardWorksheet = (
    workbook: XLSX.WorkBook,
    sheetName: string,
    rows: Array<Record<string, unknown>>,
    columns: DashboardExportColumn[]
) => {
    const worksheet = XLSX.utils.aoa_to_sheet(rowsToAoA(rows, columns));
    applyWorksheetFormatting(worksheet, rows, columns);
    XLSX.utils.book_append_sheet(workbook, worksheet, normalizeSheetName(sheetName, "Export"));
};

export const buildDashboardExcelBuffer = (rows: DashboardExportRow[], columns: DashboardExportColumn[]): Buffer => {
    const workbook = XLSX.utils.book_new();
    appendDashboardWorksheet(workbook, "Dashboard Export", rows as unknown as Array<Record<string, unknown>>, columns);
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

export const buildDashboardExcelMultiSheetBuffer = (sections: DashboardExportSection[]): Buffer => {
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    sections.forEach((section, index) => {
        const baseName = normalizeSheetName(section.title || `Sheet ${index + 1}`, "Export");
        let sheetName = baseName;
        let duplicate = 2;
        while (usedNames.has(sheetName)) {
            const suffix = ` ${duplicate}`;
            sheetName = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
            duplicate += 1;
        }
        usedNames.add(sheetName);
        appendDashboardWorksheet(workbook, sheetName, section.rows, section.columns);
    });
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

export const buildDashboardCsvBuffer = (rows: Array<Record<string, unknown>>, columns: DashboardExportColumn[]): Buffer => {
    const worksheet = XLSX.utils.aoa_to_sheet(rowsToAoA(rows, columns));
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(csv, "utf8");
};

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

const crc32 = (buffer: Buffer): number => {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
};

const writeZipDateTime = (target: Buffer, offset: number) => {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    target.writeUInt16LE(dosTime, offset);
    target.writeUInt16LE(dosDate, offset + 2);
};

const buildZipBuffer = (files: Array<{ name: string; content: Buffer }>): Buffer => {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    files.forEach((file) => {
        const name = Buffer.from(file.name, "utf8");
        const crc = crc32(file.content);

        const local = Buffer.alloc(30 + name.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(0, 8);
        writeZipDateTime(local, 10);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(file.content.length, 18);
        local.writeUInt32LE(file.content.length, 22);
        local.writeUInt16LE(name.length, 26);
        name.copy(local, 30);
        localParts.push(local, file.content);

        const central = Buffer.alloc(46 + name.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        writeZipDateTime(central, 12);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(file.content.length, 20);
        central.writeUInt32LE(file.content.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        name.copy(central, 46);
        centralParts.push(central);

        offset += local.length + file.content.length;
    });

    const centralOffset = offset;
    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralOffset, 16);

    return Buffer.concat([...localParts, ...centralParts, end]);
};

export const buildDashboardCsvZipBuffer = (sections: DashboardExportSection[]): Buffer => {
    const usedNames = new Set<string>();
    const files = sections.map((section, index) => {
        const base = normalizeFilePart(section.filenamePart, `SHEET_${index + 1}`).toLowerCase();
        let name = `${base}.csv`;
        let duplicate = 2;
        while (usedNames.has(name)) {
            name = `${base}_${duplicate}.csv`;
            duplicate += 1;
        }
        usedNames.add(name);
        return {
            name,
            content: buildDashboardCsvBuffer(section.rows, section.columns)
        };
    });
    return buildZipBuffer(files);
};

export const buildDashboardPdfBuffer = async (
    rows: DashboardExportRow[],
    meta: { cabang: string; generatedBy: string },
    columns: DashboardExportColumn[]
): Promise<Buffer> => {
    const generatedAt = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta"
    }).format(new Date());
    const html = `
<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    ${""}
    @page { size: A2 landscape; margin: 15mm; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; font-size: 9px; margin: 0; line-height: 1.3; }
    .header { background: #d71920; color: #fff; padding: 12px 18px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .brand { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
    .subtitle { font-size: 10px; opacity: .9; margin-top: 2px; }
    .title { text-align: right; font-size: 14px; font-weight: 800; text-transform: uppercase; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5px; border-radius: 4px; overflow: hidden; }
    .meta td { border: 1px solid #e2e8f0; padding: 6px 10px; }
    .meta .label { width: 120px; background: #f8fafc; font-weight: bold; color: #475569; }
    .summary { display: flex; gap: 10px; margin: 10px 0 15px; }
    .summary-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; min-width: 140px; background: #f8fafc; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .summary-box .k { color: #64748b; font-size: 8px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
    .summary-box .v { font-size: 14px; font-weight: 800; margin-top: 4px; color: #0f172a; }
    table.data { width: 100%; border-collapse: collapse; table-layout: fixed; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    table.data th, table.data td { border: 1px solid #cbd5e1; padding: 6px 5px; vertical-align: top; overflow-wrap: break-word; word-break: break-all; }
    table.data th { background: #f1f5f9; color: #334155; font-weight: 800; text-align: center; border-bottom: 2px solid #94a3b8; }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    table.data tr:hover td { background: #f1f5f9; }
    .num { text-align: right; white-space: nowrap; }
    .center { text-align: center; }
    .footer { margin-top: 15px; text-align: center; color: #94a3b8; font-size: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">SPARTA</div>
      <div class="subtitle">Building Dashboard Export</div>
    </div>
    <div class="title">Laporan Monitoring<br/>RAB, SPK, Opname, Serah Terima</div>
  </div>
  <table class="meta">
    <tr><td class="label">Cabang</td><td>${meta.cabang || "Semua Cabang"}</td><td class="label">Dibuat Oleh</td><td>${meta.generatedBy || "-"}</td></tr>
    <tr><td class="label">Tanggal Export</td><td>${generatedAt}</td><td class="label">Jumlah Data</td><td>${rows.length}</td></tr>
  </table>
  <div class="summary">
    <div class="summary-box"><div class="k">Total Proyek</div><div class="v">${rows.length}</div></div>
    <div class="summary-box"><div class="k">Done</div><div class="v">${rows.filter((row) => row.status === "done").length}</div></div>
    <div class="summary-box"><div class="k">Progress</div><div class="v">${rows.filter((row) => row.status !== "done").length}</div></div>
    <div class="summary-box"><div class="k">Total SPK</div><div class="v">${formatMoney(rows.reduce((total, row) => total + row.nominal_spk, 0))}</div></div>
  </div>
  <table class="data">
    <thead>
      <tr>
        <th style="width:24px;">No</th>
        ${columns.map((column) => `<th>${htmlEscape(column.label).replace(/\n/g, "<br/>")}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          ${columns.map((column) => `<td>${htmlEscape(displayValue((row as unknown as Record<string, unknown>)[column.key]))}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
  <div class="footer">Dokumen ini di-generate otomatis oleh sistem SPARTA Building pada ${generatedAt}</div>
</body>
</html>`;

    return renderPdfFromHtml(html);
};

export const buildDashboardExportFile = async (
    format: DashboardExportQueryInput["format"],
    rows: DashboardExportRow[],
    meta: { cabang: string; generatedBy: string },
    dataTypes?: string,
    jobTypes?: string
): Promise<{ buffer: Buffer; filename: string; contentType: string }> => {
    const columns = resolveDashboardExportColumns(dataTypes, jobTypes);
    const sections = buildDashboardExportSections(rows, dataTypes, jobTypes);
    const hasSegmentedSelection = parseCsvSet(dataTypes).size > 0 || parseCsvSet(jobTypes).size > 0;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const cabang = normalizeUpper(meta.cabang || "ALL").replace(/[^A-Z0-9]+/g, "_") || "ALL";

    if (format === "csv") {
        return {
            buffer: buildDashboardCsvZipBuffer(sections),
            filename: `SPARTA_DASHBOARD_EXPORT_${cabang}_${stamp}.zip`,
            contentType: "application/zip"
        };
    }

    if (format === "pdf") {
        return {
            buffer: await buildDashboardPdfBuffer(rows, meta, columns),
            filename: `SPARTA_DASHBOARD_EXPORT_${cabang}_${stamp}.pdf`,
            contentType: "application/pdf"
        };
    }

    return {
        buffer: hasSegmentedSelection ? buildDashboardExcelMultiSheetBuffer(sections) : buildDashboardExcelBuffer(rows, columns),
        filename: `SPARTA_DASHBOARD_EXPORT_${cabang}_${stamp}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
};



