import { Router } from "express";
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
dashboardRouter.get("/kpi-performance", getDashboardKpiPerformance);
dashboardRouter.get("/kpi-filters", getDashboardKpiFilters);
dashboardRouter.get("/kpi-drilldown", getDashboardKpiDrilldown);

// Performance KPI SAT routes.
dashboardRouter.get("/performance/summary", getPerformanceSummary);
dashboardRouter.get("/performance/filters", getPerformanceFilters);
dashboardRouter.get("/performance/options-stats", getPerformanceOptionStats);
dashboardRouter.get("/performance/drilldown", getPerformanceDrilldown);
dashboardRouter.get("/performance/detail", getPerformanceDetail);
dashboardRouter.get("/performance/table", getPerformanceTable);
dashboardRouter.get("/", getDashboardView);
dashboardRouter.get("/all", getDashboardAll);

export { dashboardRouter };
