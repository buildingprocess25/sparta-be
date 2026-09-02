import type { Request, Response } from "express";
import { getEffectiveBranchesForUser } from "../../common/branch-scope";
import { contractorPerformanceService } from "./dashboard-contractor.service";
import type { ContractorPerformanceFilters } from "./dashboard-contractor.types";

export const getContractorSummary = async (req: Request, res: Response) => {
    try {
        const filters: ContractorPerformanceFilters = {
            cabang: req.query.cabang as string,
            job_type: req.query.job_type as any,
            period: req.query.period as any,
            search: req.query.search as string
        };

        const allowedBranchesScope = await getEffectiveBranchesForUser({
            emailSat: req.user!.email_sat,
            cabang: filters.cabang || req.user!.cabang,
            roles: req.user!.roles
        });
        const allowedBranches = allowedBranchesScope.branches;
        
        const summary = await contractorPerformanceService.getSummary(filters, allowedBranches);
        
        res.json({
            status: "success",
            data: summary
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            message: error.message || "Terjadi kesalahan internal"
        });
    }
};

export const getContractorCharts = async (req: Request, res: Response) => {
    try {
        const filters: ContractorPerformanceFilters = {
            cabang: req.query.cabang as string,
            job_type: req.query.job_type as any,
            period: req.query.period as any,
            search: req.query.search as string
        };

        const allowedBranchesScope = await getEffectiveBranchesForUser({
            emailSat: req.user!.email_sat,
            cabang: filters.cabang || req.user!.cabang,
            roles: req.user!.roles
        });
        const allowedBranches = allowedBranchesScope.branches;
        
        const charts = await contractorPerformanceService.getCharts(filters, allowedBranches);
        
        res.json({
            status: "success",
            data: charts
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            message: error.message || "Terjadi kesalahan internal"
        });
    }
};

export const getContractorLeaderboard = async (req: Request, res: Response) => {
    try {
        const filters: ContractorPerformanceFilters = {
            cabang: req.query.cabang as string,
            job_type: req.query.job_type as any,
            period: req.query.period as any,
            search: req.query.search as string
        };

        const allowedBranchesScope = await getEffectiveBranchesForUser({
            emailSat: req.user!.email_sat,
            cabang: filters.cabang || req.user!.cabang,
            roles: req.user!.roles
        });
        const allowedBranches = allowedBranchesScope.branches;
        
        const leaderboard = await contractorPerformanceService.getLeaderboard(filters, allowedBranches);
        
        res.json({
            status: "success",
            data: leaderboard
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            message: error.message || "Terjadi kesalahan internal"
        });
    }
};

export const getContractorDrilldownRanking = async (req: Request, res: Response) => {
    try {
        const filters: ContractorPerformanceFilters = {
            cabang: req.query.cabang as string,
            job_type: req.query.job_type as any,
            period: req.query.period as any,
            search: req.query.search as string
        };
        const metric = req.query.metric as string;

        const allowedBranchesScope = await getEffectiveBranchesForUser({
            emailSat: req.user!.email_sat,
            cabang: filters.cabang || req.user!.cabang,
            roles: req.user!.roles
        });
        const allowedBranches = allowedBranchesScope.branches;
        const ranking = await contractorPerformanceService.getDrilldownRanking(metric, filters, allowedBranches);
        
        res.json({ status: "success", data: ranking });
    } catch (error: any) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const getContractorDrilldownSpHistory = async (req: Request, res: Response) => {
    try {
        const kontraktor = req.query.kontraktor as string;
        const history = await contractorPerformanceService.getDrilldownSpHistory(kontraktor);
        res.json({ status: "success", data: history });
    } catch (error: any) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const getContractorDrilldownUlok = async (req: Request, res: Response) => {
    try {
        const kontraktor = req.query.kontraktor as string;
        const idTokoFilter = req.query.id_toko as string;
        
        const ulokList = await contractorPerformanceService.getDrilldownUlok(kontraktor, idTokoFilter);
        res.json({ status: "success", data: ulokList });
    } catch (error: any) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

export const getContractorDrilldownDetail = async (req: Request, res: Response) => {
    try {
        const idToko = req.query.id_toko as string;
        const lingkup = req.query.lingkup as string;
        
        const detail = await contractorPerformanceService.getDrilldownDetail(idToko, lingkup);
        res.json({ status: "success", data: detail });
    } catch (error: any) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
