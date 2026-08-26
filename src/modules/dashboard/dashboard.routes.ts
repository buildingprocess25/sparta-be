import { Router, type NextFunction, type Request, type Response } from "express";
import {
    exportDashboard,
    getDashboardAll,
    getDashboardProjectDetail,
    getDashboardProjects,
    getDashboardSummary,
    getDashboardV2CardRows,
    getDashboardV2Charts,
    getDashboardV2Detail,
    getDashboardV2Summary,
    getDashboardV2Timeline,
    getDashboardView,
    getDashboardKpiPerformance,
    getDashboardKpiFilters,
    getDashboardKpiDrilldown
} from "./dashboard.controller";
import {
    getPerformanceSummary,
    getPerformanceFilters,
    getPerformanceDrilldown,
    getPerformanceDetail,
    getPerformanceOptionStats,
    getPerformanceTable
} from "./dashboard-performance.controller";


const normalizeRole = (role: string): string => role.trim().toUpperCase();

const isSuperHuman = (req: Request): boolean =>
    Boolean(req.user?.roles.some((role) => normalizeRole(role).includes("SUPER HUMAN")));

const isContractorPerformanceBlocked = (req: Request): boolean =>
    Boolean(req.user?.roles.some((role) => {
        const normalized = normalizeRole(role);
        return normalized.includes("KONTRAKTOR") || normalized === "DIREKTUR";
    }));

const requireSuperHumanForPerformance = (req: Request, res: Response, next: NextFunction) => {
    if (isSuperHuman(req) && !isContractorPerformanceBlocked(req)) {
        next();
        return;
    }

    res.status(403).json({
        status: "coming_soon",
        message: "Performance Internal SAT sedang disiapkan dan tidak tersedia untuk kontraktor atau direktur kontraktor."
    });
};
const dashboardRouter = Router();

dashboardRouter.get("/export", exportDashboard);
dashboardRouter.get("/v2/summary", getDashboardV2Summary);
dashboardRouter.get("/v2/cards/:cardType", getDashboardV2CardRows);
dashboardRouter.get("/v2/timeline/:tokoId", getDashboardV2Timeline);
dashboardRouter.get("/v2/detail/:tokoId/:documentType/:rawId", getDashboardV2Detail);
dashboardRouter.get("/v2/charts", getDashboardV2Charts);
dashboardRouter.get("/summary", getDashboardSummary);
dashboardRouter.get("/projects", getDashboardProjects);
dashboardRouter.get("/projects/:tokoId", getDashboardProjectDetail);
dashboardRouter.get("/kpi-performance", requireSuperHumanForPerformance, getDashboardKpiPerformance);
dashboardRouter.get("/kpi-filters", requireSuperHumanForPerformance, getDashboardKpiFilters);
dashboardRouter.get("/kpi-drilldown", requireSuperHumanForPerformance, getDashboardKpiDrilldown);

// Performance KPI SAT routes.
dashboardRouter.get("/performance/summary", requireSuperHumanForPerformance, getPerformanceSummary);
dashboardRouter.get("/performance/filters", requireSuperHumanForPerformance, getPerformanceFilters);
dashboardRouter.get("/performance/options-stats", requireSuperHumanForPerformance, getPerformanceOptionStats);
dashboardRouter.get("/performance/drilldown", requireSuperHumanForPerformance, getPerformanceDrilldown);
dashboardRouter.get("/performance/detail", requireSuperHumanForPerformance, getPerformanceDetail);
dashboardRouter.get("/performance/table", requireSuperHumanForPerformance, getPerformanceTable);
dashboardRouter.get("/", getDashboardView);
dashboardRouter.get("/all", getDashboardAll);

export { dashboardRouter };
