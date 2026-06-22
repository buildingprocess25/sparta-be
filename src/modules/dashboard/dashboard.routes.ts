import { Router } from "express";
import {
    exportDashboard,
    getDashboardAll,
    getDashboardProjectDetail,
    getDashboardProjects,
    getDashboardSummary,
    getDashboardView
} from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/export", exportDashboard);
dashboardRouter.get("/summary", getDashboardSummary);
dashboardRouter.get("/projects", getDashboardProjects);
dashboardRouter.get("/projects/:tokoId", getDashboardProjectDetail);
dashboardRouter.get("/", getDashboardView);
dashboardRouter.get("/all", getDashboardAll);

export { dashboardRouter };
