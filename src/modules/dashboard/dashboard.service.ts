import { AppError } from "../../common/app-error";
import {
    buildDashboardExportFile,
    buildDashboardExportRows,
    buildDokumentasiIndex,
    filterDashboardExportAccess
} from "./dashboard.export";
import type { DashboardAllQueryInput, DashboardExportQueryInput, DashboardQueryInput } from "./dashboard.schema";
import { dashboardRepository } from "./dashboard.repository";

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
