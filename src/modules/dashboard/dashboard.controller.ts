import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { AppError } from "../../common/app-error";
import {
    dashboardAllQuerySchema,
    dashboardExportQuerySchema,
    dashboardProjectsQuerySchema,
    dashboardQuerySchema,
    dashboardSummaryQuerySchema,
    dashboardV2CardRowsQuerySchema,
    dashboardV2CardTypeSchema,
    dashboardV2ChartsQuerySchema,
    dashboardV2DocumentTypeSchema,
    dashboardV2ScopeQuerySchema
} from "./dashboard.schema";
import { dashboardService } from "./dashboard.service";
import { injectBranchFilter } from "../../common/branch-filter-helper";
import { dashboardV2Service } from "./dashboard-v2.service";

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

export const getDashboardV2Summary = asyncHandler(async (req: Request, res: Response) => {
    let query = dashboardV2ScopeQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const data = await dashboardV2Service.getSummary(query);
    res.json({ status: "success", data });
});

export const getDashboardV2CardRows = asyncHandler(async (req: Request, res: Response) => {
    const cardType = dashboardV2CardTypeSchema.parse(req.params.cardType);
    let query = dashboardV2CardRowsQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const result = await dashboardV2Service.getCardRows(cardType, query);
    res.json({ status: "success", ...result });
});

export const getDashboardV2Timeline = asyncHandler(async (req: Request, res: Response) => {
    const tokoId = Number(req.params.tokoId);
    if (!Number.isInteger(tokoId) || tokoId <= 0) {
        throw new AppError("ID toko tidak valid", 422);
    }
    const data = await dashboardV2Service.getTimeline(tokoId);
    res.json({ status: "success", data });
});

export const getDashboardV2Detail = asyncHandler(async (req: Request, res: Response) => {
    const tokoId = Number(req.params.tokoId);
    const rawId = Number(req.params.rawId);
    if (!Number.isInteger(tokoId) || tokoId <= 0) {
        throw new AppError("ID toko tidak valid", 422);
    }
    if (!Number.isInteger(rawId) || rawId <= 0) {
        throw new AppError("ID dokumen tidak valid", 422);
    }
    const documentType = dashboardV2DocumentTypeSchema.parse(req.params.documentType);
    const data = await dashboardV2Service.getDetail(tokoId, documentType, rawId);
    res.json({ status: "success", data });
});

export const getDashboardV2Charts = asyncHandler(async (req: Request, res: Response) => {
    let query = dashboardV2ChartsQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const data = await dashboardV2Service.getCharts(query);
    res.json({ status: "success", data });
});

import { dashboardKpiQuerySchema } from "./dashboard.schema";
import { dashboardKpiService } from "./dashboard-kpi.service";

export const getDashboardKpiPerformance = asyncHandler(async (req: Request, res: Response) => {
    let query = dashboardKpiQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const data = await dashboardKpiService.getKpiPerformance(query);
    res.json({ status: "success", data });
});

export const getDashboardKpiFilters = asyncHandler(async (req: Request, res: Response) => {
    let query = dashboardKpiQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    const data = await dashboardKpiService.getKpiFilters(query);
    res.json({ status: "success", data });
});

export const getDashboardKpiDrilldown = asyncHandler(async (req: Request, res: Response) => {
    // Add kpi_type to query before parse if it exists
    let query = dashboardKpiQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user!, query);
    
    // Pass the raw kpi_type along
    const finalQuery = { ...query, kpi_type: req.query.kpi_type };
    const { data, meta } = await dashboardKpiService.getKpiDrilldown(finalQuery);
    res.json({ status: "success", data, meta });
});
