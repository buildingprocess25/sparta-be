import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    advanceDcProjectStageSchema,
    createDcProjectSchema,
    createDcTenderSchema,
    createDcVendorSchema,
    createDcVendorUserSchema,
    dcApprovalListQuerySchema,
    dcDocumentListQuerySchema,
    dcProjectListQuerySchema
} from "./dc-development.schema";
import { dcDevelopmentService } from "./dc-development.service";

export const listDcProjects = asyncHandler(async (req: Request, res: Response) => {
    const query = dcProjectListQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.listProjects(query);
    res.json({ status: "success", data });
});

export const createDcProject = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcProjectSchema.parse(req.body);
    const data = await dcDevelopmentService.createProject(input);
    res.status(201).json({
        status: "success",
        message: "Project DC berhasil dibuat",
        data
    });
});

export const getDcProjectById = asyncHandler(async (req: Request, res: Response) => {
    const data = await dcDevelopmentService.getProjectById(req.params.id);
    res.json({ status: "success", data });
});

export const advanceDcProjectStage = asyncHandler(async (req: Request, res: Response) => {
    const input = advanceDcProjectStageSchema.parse(req.body);
    const data = await dcDevelopmentService.advanceProjectStage(req.params.id, input);
    res.json({
        status: "success",
        message: "Stage project DC berhasil diperbarui",
        data
    });
});

export const createDcTender = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcTenderSchema.parse(req.body);
    const data = await dcDevelopmentService.createTender(req.params.id, input);
    res.status(201).json({
        status: "success",
        message: "Tender DC berhasil dibuat",
        data
    });
});

export const listDcVendors = asyncHandler(async (_req: Request, res: Response) => {
    const data = await dcDevelopmentService.listVendors();
    res.json({ status: "success", data });
});

export const createDcVendor = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcVendorSchema.parse(req.body);
    const data = await dcDevelopmentService.createVendor(input);
    res.status(201).json({
        status: "success",
        message: "Vendor DC berhasil dibuat",
        data
    });
});

export const createDcVendorUser = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcVendorUserSchema.parse(req.body);
    const data = await dcDevelopmentService.createVendorUser(req.params.id, input);
    res.status(201).json({
        status: "success",
        message: "User vendor DC berhasil dibuat",
        data
    });
});

export const listDcApprovals = asyncHandler(async (req: Request, res: Response) => {
    const query = dcApprovalListQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.listApprovals(query);
    res.json({ status: "success", data });
});

export const listDcDocuments = asyncHandler(async (req: Request, res: Response) => {
    const query = dcDocumentListQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.listDocuments(query);
    res.json({ status: "success", data });
});

export const viewDcDocument = asyncHandler(async (req: Request, res: Response) => {
    dcDevelopmentService.getDocumentProxyPlaceholder(req.params.id, "view");
    res.end();
});

export const downloadDcDocument = asyncHandler(async (req: Request, res: Response) => {
    dcDevelopmentService.getDocumentProxyPlaceholder(req.params.id, "download");
    res.end();
});
