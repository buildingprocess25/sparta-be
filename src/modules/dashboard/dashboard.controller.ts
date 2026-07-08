import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { AppError } from "../../common/app-error";
import {
    dashboardAllQuerySchema,
    dashboardExportQuerySchema,
    dashboardProjectsQuerySchema,
    dashboardQuerySchema,
    dashboardSummaryQuerySchema
} from "./dashboard.schema";
import { dashboardService } from "./dashboard.service";
import { injectBranchFilter } from "../../common/branch-filter-helper";

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
    let query = dashboardExportQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const result = await dashboardService.exportDashboard(query);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
});

export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
    let query = dashboardSummaryQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const data = await dashboardService.getDashboardSummary(query);
    res.json({ status: "success", data });
});

export const getDashboardProjects = asyncHandler(async (req: Request, res: Response) => {
    let query = dashboardProjectsQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const result = await dashboardService.getDashboardProjects(query);
    res.json({ status: "success", ...result });
});

export const getDashboardProjectDetail = asyncHandler(async (req: Request, res: Response) => {
    const tokoId = Number(req.params.tokoId);
    if (!Number.isInteger(tokoId) || tokoId <= 0) {
        throw new AppError("ID toko tidak valid", 422);
    }
    const data = await dashboardService.getDashboardProjectDetail(tokoId);
    res.json({ status: "success", data });
});
