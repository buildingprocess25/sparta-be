import { Router } from "express";
import { exportDashboard, getDashboardAll, getDashboardView } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/export", exportDashboard);
dashboardRouter.get("/", getDashboardView);
dashboardRouter.get("/all", getDashboardAll);

export { dashboardRouter };
