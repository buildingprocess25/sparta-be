import * as XLSX from "xlsx";
import { AppError } from "../../common/app-error";
import { isSameBranchScope } from "../../common/branch-scope";
import { renderPdfFromHtml } from "../../common/html-pdf";
import { calculateDendaNominal, isHeadOfficeCabang } from "../denda/denda-keterlambatan";
import type { DashboardData } from "./dashboard.repository";
import type { DashboardExportQueryInput } from "./dashboard.schema";

export type DashboardExportColumn = {
    key: keyof DashboardExportRow;
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
    total_investasi_bangunan: number;
    total_investasi_area_terbuka: number;
    total_investasi_non_sbo: number;
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
    { key: "nilai_toko", label: "Nilai Toko" },
    { key: "total_investasi_bangunan", label: "TOTAL INVESTASI  BIAYA \n(BANGUNAN)\n(CF+CG)-BB)" },
    { key: "total_investasi_area_terbuka", label: "TOTAL INVESTASI  BIAYA \n(AREA TERBUKA)\n(BB) " },
    { key: "total_investasi_non_sbo", label: "TOTAL INVESTASI BIAYA NON SBO" }
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

const dataTypeColumns: Record<string, Array<keyof DashboardExportRow>> = {
    IDENTITAS: ["timestamp", "cabang", "nomor_ulok", "proyek", "lingkup_pekerjaan", "kontraktor", "nama_toko", "kode_toko", "kategori", "pic", "status"],
    RAB: ["status_rab", "luas_bangunan", "luas_terbangunan", "luas_area_terbuka", "luas_area_parkir", "luas_area_sales", "luas_gudang", "pekerjaan_area_terbuka", "pekerjaan_beanspot", "total_penawaran_final", "timestamp_acc_manager", "tanggal_grand_opening"],
    SPK: ["timestamp_spk", "durasi_spk", "nominal_spk", "awal_spk", "akhir_spk", "tambah_spk", "akhir_spk_setelah", "real_spk"],
    OPNAME: ["tanggal_serah_terima", "keterlambatan", "denda", "kerja_tambah", "kerja_kurang", "grand_total_opname_final", "tanggal_opname_final", "status_opname_final", "nilai_toko"],
    INVESTASI: ["total_investasi_bangunan", "total_investasi_area_terbuka", "total_investasi_non_sbo"]
};

const resolveDashboardExportColumns = (dataTypes?: string): DashboardExportColumn[] => {
    const selected = parseCsvSet(dataTypes);
    if (selected.size === 0) return dashboardExportColumns;
    const keys = new Set<keyof DashboardExportRow>();
    selected.forEach((type) => dataTypeColumns[type]?.forEach((key) => keys.add(key)));
    if (keys.size === 0) return dashboardExportColumns;
    return dashboardExportColumns.filter((column) => keys.has(column.key));
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
    const selectedTokoIds = parseSelectedTokoIds(query.toko_ids);
    return projects.filter((project) => {
        const projectCabang = normalizeUpper(project.toko.cabang);
        if (isHeadOfficeCabang(projectCabang)) return false;
        if (actorCabang !== "HEAD OFFICE" && !isSameBranchScope(projectCabang, actorCabang)) return false;
        if (cabangFilter && cabangFilter !== "ALL" && projectCabang !== cabangFilter) return false;
        if (selectedCabangs.size > 0 && !selectedCabangs.has(projectCabang)) return false;
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
        const totalInvestArea = areaTerbuka;
        const totalInvestBuilding = Math.max(0, grandTotalOpname - totalInvestArea);

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
            pekerjaan_area_terbuka: totalInvestArea,
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
            total_investasi_bangunan: totalInvestBuilding,
            total_investasi_area_terbuka: totalInvestArea,
            total_investasi_non_sbo: totalInvestBuilding + totalInvestArea
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

const rowsToAoA = (rows: DashboardExportRow[], columns: DashboardExportColumn[]) => [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => row[column.key]))
];

export const buildDashboardExcelBuffer = (rows: DashboardExportRow[], columns: DashboardExportColumn[]): Buffer => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rowsToAoA(rows, columns));
    worksheet["!cols"] = columns.map((column) => ({
        wch: Math.min(Math.max(column.label.replace(/\n/g, " ").length + 2, 12), 32)
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dashboard Export");
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

export const buildDashboardCsvBuffer = (rows: DashboardExportRow[], columns: DashboardExportColumn[]): Buffer => {
    const worksheet = XLSX.utils.aoa_to_sheet(rowsToAoA(rows, columns));
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(csv, "utf8");
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
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #1f2937; font-size: 8.5px; margin: 0; }
    .header { background: #d71920; color: #fff; padding: 10px 14px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .brand { font-size: 18px; font-weight: 800; letter-spacing: 1px; }
    .subtitle { font-size: 9px; opacity: .9; margin-top: 2px; }
    .title { text-align: right; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8.5px; }
    .meta td { border: 1px solid #d8dee6; padding: 5px 7px; }
    .meta .label { width: 120px; background: #f8fafc; font-weight: 700; }
    .summary { display: flex; gap: 8px; margin: 8px 0 10px; }
    .summary-box { border: 1px solid #d8dee6; border-radius: 5px; padding: 7px 9px; min-width: 120px; background: #f8fafc; }
    .summary-box .k { color: #64748b; font-size: 7.5px; text-transform: uppercase; font-weight: 700; }
    .summary-box .v { font-size: 12px; font-weight: 800; margin-top: 3px; }
    table.data { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.data th, table.data td { border: 1px solid #cbd5e1; padding: 4px 5px; vertical-align: top; overflow-wrap: anywhere; }
    table.data th { background: #eef6ff; color: #111827; font-weight: 800; text-align: center; }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    .num { text-align: right; white-space: nowrap; }
    .center { text-align: center; }
    .footer { margin-top: 10px; text-align: center; color: #94a3b8; font-size: 7.5px; border-top: 1px solid #e5e7eb; padding-top: 6px; }
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
          ${columns.map((column) => `<td>${htmlEscape(row[column.key])}</td>`).join("")}
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
    dataTypes?: string
): Promise<{ buffer: Buffer; filename: string; contentType: string }> => {
    const columns = resolveDashboardExportColumns(dataTypes);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const cabang = normalizeUpper(meta.cabang || "ALL").replace(/[^A-Z0-9]+/g, "_") || "ALL";

    if (format === "csv") {
        return {
            buffer: buildDashboardCsvBuffer(rows, columns),
            filename: `SPARTA_DASHBOARD_EXPORT_${cabang}_${stamp}.csv`,
            contentType: "text/csv; charset=utf-8"
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
        buffer: buildDashboardExcelBuffer(rows, columns),
        filename: `SPARTA_DASHBOARD_EXPORT_${cabang}_${stamp}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
};



