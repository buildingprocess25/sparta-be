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
    getDashboardView
} from "./dashboard.controller";

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
dashboardRouter.get("/", getDashboardView);
dashboardRouter.get("/all", getDashboardAll);

export { dashboardRouter };
