import { AppError } from "../../common/app-error";
import {
    buildDashboardExportFile,
    buildDashboardExportRows,
    buildDokumentasiIndex,
    filterDashboardExportAccess
} from "./dashboard.export";
import type {
    DashboardAllQueryInput,
    DashboardExportQueryInput,
    DashboardProjectsQueryInput,
    DashboardQueryInput,
    DashboardSummaryQueryInput
} from "./dashboard.schema";
import { dashboardRepository } from "./dashboard.repository";
import {
    getDashboardPenalty,
    getDashboardStage,
    scopeDashboardProjects,
    toDashboardProjectRow
} from "./dashboard.presentation";

export const dashboardService = {
    async getDashboard(query: DashboardQueryInput) {
        const toko = await dashboardRepository.findTokoByQuery(query);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }

        return dashboardRepository.findDashboardByTokoId(toko.id);
    },

    async getDashboardAll(query: DashboardAllQueryInput) {
        return dashboardRepository.findAllDashboard(query);
    },

    async getDashboardSummary(query: DashboardSummaryQueryInput) {
        const projects = scopeDashboardProjects(
            await dashboardRepository.findAllDashboard({ search: query.search }),
            query
        );
        const stages: Record<string, number> = {
            "Approval RAB": 0,
            "Proses Gantt": 0,
            "Proses PJU": 0,
            "Approval SPK": 0,
            Ongoing: 0,
            "Kerja Tambah Kurang": 0,
            Done: 0,
        };
        let attention = 0;
        let penawaran = 0;
        let nilaiSpk = 0;
        let totalDenda = 0;

        for (const project of projects) {
            const stage = getDashboardStage(project);
            stages[stage] = (stages[stage] || 0) + 1;
            const penalty = getDashboardPenalty(project);
            if (stage !== "Done" && penalty.days > 0) attention += 1;
            penawaran += Number(project.rab[0]?.grand_total_final || 0);
            nilaiSpk += project.spk.reduce((sum, spk) => sum + Number(spk.grand_total || 0), 0);
            totalDenda += penalty.amount;
        }

        return {
            generated_at: new Date().toISOString(),
            total: projects.length,
            attention,
            penawaran,
            nilai_spk: nilaiSpk,
            total_denda: totalDenda,
            stages,
        };
    },

    async getDashboardProjects(query: DashboardProjectsQueryInput) {
        let rows = scopeDashboardProjects(
            await dashboardRepository.findAllDashboard({ search: query.search }),
            query
        ).map(toDashboardProjectRow);

        if (query.stage) rows = rows.filter((row) => row.stage === query.stage);
        if (query.attention !== undefined) rows = rows.filter((row) => row.attention === query.attention);

        rows.sort((a, b) => {
            if (query.sort === "name") return String(a.toko.nama_toko || "").localeCompare(String(b.toko.nama_toko || ""));
            if (query.sort === "latest") return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
            return Number(b.attention) - Number(a.attention)
                || b.penalty.amount - a.penalty.amount
                || b.late_days - a.late_days;
        });

        const total = rows.length;
        const start = (query.page - 1) * query.limit;
        return {
            data: rows.slice(start, start + query.limit),
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                total_pages: Math.ceil(total / query.limit),
            },
        };
    },

    async getDashboardProjectDetail(tokoId: number) {
        return dashboardRepository.findDashboardByTokoId(tokoId);
    },

    async exportDashboard(query: DashboardExportQueryInput) {
        const projects = await dashboardRepository.findAllDashboard({ search: query.search });
        const scopedProjects = filterDashboardExportAccess(projects, query);
        const dokumentasiRows = await dashboardRepository.findDokumentasiBangunanForExport();
        const rows = buildDashboardExportRows(scopedProjects, buildDokumentasiIndex(dokumentasiRows));
        const cabangLabel = query.cabang && query.cabang !== "ALL"
            ? query.cabang
            : (query.actor_cabang.toUpperCase() === "HEAD OFFICE" ? "Semua Cabang" : query.actor_cabang);

        return buildDashboardExportFile(query.format, rows, {
            cabang: cabangLabel,
            generatedBy: query.actor_role
        });
    }
};
