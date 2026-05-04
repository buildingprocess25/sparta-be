import { Router } from "express";
import { getDashboardView } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/", getDashboardView);

export { dashboardRouter };
