import type { DashboardData } from "./dashboard.repository";
import type { DashboardProjectsQueryInput, DashboardSummaryQueryInput } from "./dashboard.schema";

const GLOBAL_ROLES = [
    "BUILDING & MAINTENANCE SUPER HUMAN",
    "BUILDING & MAINTENANCE REGIONAL MANAGER",
    "BUILDING MAINTENANCE & ENERGY SYSTEM MANAGER",
    "BUILDING & MAINTENANCE GENERAL MANAGER",
    "STORE & BRANCH CONTROLLING SPECIALIST",
    "HEAD OFFICE",
];

const normalize = (value: unknown) => String(value || "").trim().toUpperCase();
const parseDate = (value: unknown) => {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

const approvedSpks = (project: DashboardData) => {
    const valid = project.spk.filter((spk) =>
        ["APPROVED", "ACTIVE", "SPK_APPROVED", "DISETUJUI", "AKTIF", "SELESAI"].includes(normalize(spk.status))
    );
    return valid.length > 0 ? valid : project.spk.slice(0, 1);
};

export const getDashboardStage = (project: DashboardData) => {
    const rab = project.rab[0];
    const rabStatus = normalize(rab?.status);
    const hasApprovedSpk = project.spk.some((spk) =>
        ["APPROVED", "ACTIVE", "SPK_APPROVED", "DISETUJUI", "AKTIF", "SELESAI"].includes(normalize(spk.status))
    );
    const hasWaitingSpk = project.spk.some((spk) => normalize(spk.status) === "WAITING_FOR_BM_APPROVAL");
    const opname = project.opname_final.find((item) => String(item.link_pdf_opname || "").trim());
    const hasSt = project.berkas_serah_terima.length > 0;

    if (opname && normalize(opname.status_opname_final) === "DISETUJUI") return "Done";
    if (opname || hasSt) return "Kerja Tambah Kurang";
    if (hasApprovedSpk) return "Ongoing";
    if (hasWaitingSpk) return "Approval SPK";
    if (rabStatus === "DISETUJUI") return "Proses PJU";
    if (rab && rabStatus === "MENUNGGU GANTT CHART") return "Proses Gantt";
    return "Approval RAB";
};

export const getDashboardLateDays = (project: DashboardData) => {
    const opname = project.opname_final[0];
    if (Number(opname?.hari_denda || 0) > 0) return Number(opname?.hari_denda || 0);

    const endDates = approvedSpks(project)
        .map((spk) => {
            const extensionDates = spk.pertambahan_spk
                .filter((item) => ["APPROVED", "DISETUJUI", "DISETUJUI BM"].includes(normalize(item.status_persetujuan)))
                .map((item) => parseDate(item.tanggal_spk_akhir_setelah_perpanjangan))
                .filter((date): date is Date => Boolean(date));
            return extensionDates.sort((a, b) => b.getTime() - a.getTime())[0] || parseDate(spk.waktu_selesai);
        })
        .filter((date): date is Date => Boolean(date));
    const target = endDates.sort((a, b) => b.getTime() - a.getTime())[0];
    if (!target) return 0;

    const compareDate = parseDate(project.berkas_serah_terima[0]?.created_at) || new Date();
    return Math.max(0, Math.floor((compareDate.getTime() - target.getTime()) / 86_400_000));
};

export const getDashboardPenalty = (project: DashboardData) => {
    const opname = project.opname_final[0];
    const official = Number(opname?.nilai_denda || 0);
    const officialHari = Number(opname?.hari_denda || 0);
    const days = getDashboardLateDays(project);

    // If opname_final has a stored tanggal_akhir_spk_denda, a real denda calculation has been
    // persisted (even if the result is 0 – e.g. ME peer delivered on time → minimum = 0).
    // In that case we MUST use the official stored values and NOT fall through to the estimasi path.
    const hasOfficialCalculation = Boolean(opname?.tanggal_akhir_spk_denda);

    if (official > 0 || officialHari > 0 || hasOfficialCalculation) {
        return { amount: official, days: officialHari || days, source: "Resmi" as const };
    }
    const amount = Math.min((Math.min(days, 5) * 1_000_000) + (Math.max(0, Math.min(days - 5, 10)) * 500_000), 10_000_000);
    return { amount, days, source: "Estimasi" as const };
};

const canViewAllBranches = (query: DashboardSummaryQueryInput | DashboardProjectsQueryInput) => {
    const roles = normalize(query.actor_role).split(",").map((role) => role.trim());
    return normalize(query.actor_cabang) === "HEAD OFFICE" || roles.some((role) => GLOBAL_ROLES.includes(role));
};

const matchesCompany = (project: DashboardData, company?: string) => {
    const target = normalize(company);
    if (!target) return true;
    return [
        project.toko.nama_kontraktor,
        ...project.rab.map((rab) => rab.nama_pt),
        ...project.spk.map((spk) => spk.nama_kontraktor),
    ].some((value) => normalize(value) === target);
};

export const scopeDashboardProjects = (
    projects: DashboardData[],
    query: DashboardSummaryQueryInput | DashboardProjectsQueryInput
) => {
    const selectedBranch = normalize(query.cabang);
    const actorBranch = normalize(query.actor_cabang);
    const search = normalize(query.search);
    return projects.filter((project) => {
        const branch = normalize(project.toko.cabang);
        if (!canViewAllBranches(query) && branch !== actorBranch) return false;
        if (selectedBranch && selectedBranch !== "ALL" && branch !== selectedBranch) return false;
        if (!matchesCompany(project, query.actor_company)) return false;
        if (search && ![
            project.toko.nama_toko,
            project.toko.nomor_ulok,
            project.toko.kode_toko,
            project.toko.cabang,
            project.toko.nama_kontraktor,
        ].some((value) => normalize(value).includes(search))) return false;
        return true;
    });
};

export const toDashboardProjectRow = (project: DashboardData) => {
    const stage = getDashboardStage(project);
    const lateDays = getDashboardLateDays(project);
    const penalty = getDashboardPenalty(project);
    const rab = project.rab[0];
    const spk = project.spk[0];
    return {
        toko: project.toko,
        stage,
        attention: stage !== "Done" && (lateDays > 0 || penalty.amount > 0),
        late_days: lateDays,
        penalty,
        penawaran: Number(rab?.grand_total_final || 0),
        nilai_spk: Number(spk?.grand_total || 0),
        rab_status: rab?.status || null,
        spk_status: spk?.status || null,
        opname_status: project.opname_final[0]?.status_opname_final || null,
        has_serah_terima: project.berkas_serah_terima.length > 0,
        updated_at: project.berkas_serah_terima[0]?.created_at
            || project.opname_final[0]?.created_at
            || spk?.created_at
            || rab?.created_at
            || null,
    };
};
