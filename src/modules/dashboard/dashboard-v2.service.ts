import { AppError } from "../../common/app-error";
import { dashboardRepository } from "./dashboard.repository";
import { scopeDashboardProjects } from "./dashboard.presentation";
import type {
    DashboardV2CardRowsQueryInput,
    DashboardV2ChartsQueryInput,
    DashboardV2ScopeQueryInput
} from "./dashboard.schema";
import type { DashboardV2CardType, DashboardV2DocumentType } from "./dashboard-v2.types";
import {
    buildDashboardV2CardRows,
    buildDashboardV2Charts,
    buildDashboardV2Detail,
    buildDashboardV2SummaryCards,
    buildDashboardV2TimelineNodes,
    matchesDashboardV2JobType
} from "./dashboard-v2.rules";

const scopedProjects = async (query: DashboardV2ScopeQueryInput) => {
    const projects = await dashboardRepository.findAllDashboard({ search: query.search });
    return scopeDashboardProjects(projects, query)
        .filter((project) => matchesDashboardV2JobType(project, query.job_type));
};

export const dashboardV2Service = {
    async getSummary(query: DashboardV2ScopeQueryInput) {
        return buildDashboardV2SummaryCards(await scopedProjects(query));
    },

    async getCardRows(cardType: DashboardV2CardType, query: DashboardV2CardRowsQueryInput) {
        const rows = buildDashboardV2CardRows(await scopedProjects(query), cardType);
        const total = rows.length;
        const start = (query.page - 1) * query.limit;
        return {
            data: rows.slice(start, start + query.limit),
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                total_pages: Math.ceil(total / query.limit)
            }
        };
    },

    async getTimeline(tokoId: number) {
        const project = await dashboardRepository.findDashboardByTokoId(tokoId);
        if (!project?.toko) throw new AppError("Data toko tidak ditemukan", 404);
        return buildDashboardV2TimelineNodes(project);
    },

    async getDetail(tokoId: number, documentType: DashboardV2DocumentType, rawId: number) {
        const project = await dashboardRepository.findDashboardByTokoId(tokoId);
        if (!project?.toko) throw new AppError("Data toko tidak ditemukan", 404);
        return buildDashboardV2Detail(project, documentType, rawId);
    },

    async getCharts(query: DashboardV2ChartsQueryInput) {
        return buildDashboardV2Charts(await scopedProjects(query), query.period);
    }
};
