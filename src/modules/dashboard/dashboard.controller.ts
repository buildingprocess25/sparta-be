import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { dashboardAllQuerySchema, dashboardExportQuerySchema, dashboardQuerySchema } from "./dashboard.schema";
import { dashboardService } from "./dashboard.service";

export const getDashboardView = asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await dashboardService.getDashboard(query);
    res.json({ status: "success", data });
});

export const getDashboardAll = asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardAllQuerySchema.parse(req.query);
    const data = await dashboardService.getDashboardAll(query);
    res.json({ status: "success", data });
});

export const exportDashboard = asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardExportQuerySchema.parse(req.query);
    const result = await dashboardService.exportDashboard(query);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
});
