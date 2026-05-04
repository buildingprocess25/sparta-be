import { Router } from "express";
import { getDashboardAll, getDashboardView } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/", getDashboardView);
dashboardRouter.get("/all", getDashboardAll);

export { dashboardRouter };
