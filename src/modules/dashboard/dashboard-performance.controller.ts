import { Request, Response } from "express";
import { dashboardPerformanceService } from "./dashboard-performance.service";

export const getPerformanceSummary = async (req: Request, res: Response) => {
    try {
        const query = {
            actor_cabang: req.user?.cabang || "HEAD OFFICE", // Assuming req.user is set by auth middleware
            cabang: req.query.cabang as string,
            coordinator: req.query.coordinator as string,
            support: req.query.support as string,
            job_type: req.query.job_type as string,
            search: req.query.search as string,
        };

        const summary = await dashboardPerformanceService.getSummary(query);
        res.json({
            status: "success",
            data: summary,
        });
    } catch (error) {
        console.error("Error in getPerformanceSummary:", error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

export const getPerformanceDrilldown = async (req: Request, res: Response) => {
    try {
        const query: any = {
            actor_cabang: req.user?.cabang || "HEAD OFFICE",
            cabang: req.query.cabang as string,
            coordinator: req.query.coordinator as string,
            support: req.query.support as string,
            job_type: req.query.job_type as string,
            search: req.query.search as string,
            card_type: req.query.card_type as string,
            sla_role: req.query.sla_role as string,
            sla_doc: req.query.sla_doc as string,
            person_role: req.query.person_role as string,
            person_name: req.query.person_name as string,
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 50,
        };

        const result = await dashboardPerformanceService.getDrilldown(query);
        res.json({
            status: "success",
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        console.error("Error in getPerformanceDrilldown:", error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

export const getPerformanceTable = async (req: Request, res: Response) => {
    try {
        const query: any = {
            actor_cabang: req.user?.cabang || "HEAD OFFICE",
            cabang: req.query.cabang as string,
            coordinator: req.query.coordinator as string,
            support: req.query.support as string,
            job_type: req.query.job_type as string,
            search: req.query.search as string,
        };

        const result = await dashboardPerformanceService.getTable(query);
        res.json({
            status: "success",
            data: result,
        });
    } catch (error) {
        console.error("Error in getPerformanceTable:", error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};
