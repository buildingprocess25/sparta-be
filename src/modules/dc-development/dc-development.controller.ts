import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    advanceDcProjectStageSchema,
    createDcProjectSchema,
    createDcArchiveProjectSchema,
    createDcTenderSchema,
    createDcVendorSchema,
    createDcVendorUserSchema,
    createDcDocumentSchema,
    dcDocumentActorQuerySchema,
    dcApprovalListQuerySchema,
    dcArchiveProjectListQuerySchema,
    dcDocumentListQuerySchema,
    dcProjectListQuerySchema,
    updateDcDocumentSchema
} from "./dc-development.schema";
import { dcDevelopmentService, type UploadedDcDocumentFile } from "./dc-development.service";

const getUploadedFiles = (req: Request): UploadedDcDocumentFile[] => {
    const files = req.files as UploadedDcDocumentFile[] | undefined;
    return files ?? [];
};

export const listDcProjects = asyncHandler(async (req: Request, res: Response) => {
    const query = dcProjectListQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.listProjects(query);
    res.json({ status: "success", data });
});

export const listDcArchiveProjects = asyncHandler(async (req: Request, res: Response) => {
    const query = dcArchiveProjectListQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.listArchiveProjects(query);
    res.json({ status: "success", data });
});

export const createDcArchiveProject = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcArchiveProjectSchema.parse(req.body);
    const data = await dcDevelopmentService.createArchiveProject(input);
    res.status(201).json({
        status: "success",
        message: "Data arsip dokumen DC berhasil dibuat",
        data
    });
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

export const createDcDocument = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcDocumentSchema.parse(req.body);
    const data = await dcDevelopmentService.createDocument(input, getUploadedFiles(req));
    res.status(201).json({
        status: "success",
        message: "Dokumen DC berhasil disimpan",
        data
    });
});

export const getDcDocumentDetail = asyncHandler(async (req: Request, res: Response) => {
    const actor = dcDocumentActorQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.getDocumentDetail(req.params.id, actor);
    res.json({ status: "success", data });
});

export const updateDcDocument = asyncHandler(async (req: Request, res: Response) => {
    const input = updateDcDocumentSchema.parse(req.body);
    const data = await dcDevelopmentService.updateDocument(req.params.id, input, getUploadedFiles(req));
    res.json({
        status: "success",
        message: "Dokumen DC berhasil diperbarui",
        data
    });
});

export const deleteDcDocument = asyncHandler(async (req: Request, res: Response) => {
    const actor = dcDocumentActorQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.deleteDocument(req.params.id, actor);
    res.json({
        status: "success",
        message: "Dokumen DC berhasil dihapus",
        data
    });
});

export const viewDcDocument = asyncHandler(async (req: Request, res: Response) => {
    const actor = dcDocumentActorQuerySchema.parse(req.query);
    const file = await dcDevelopmentService.getDocumentFile(req.params.id, actor);
    if (!file.buffer && file.link) {
        res.redirect(file.link);
        return;
    }
    if (!file.buffer) {
        res.status(404).json({ status: "error", message: "File dokumen DC tidak ditemukan" });
        return;
    }
    res.setHeader("Content-Type", file.document.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.document.file_name || "dokumen-dc")}"`);
    res.send(file.buffer);
});

export const downloadDcDocument = asyncHandler(async (req: Request, res: Response) => {
    const actor = dcDocumentActorQuerySchema.parse(req.query);
    const file = await dcDevelopmentService.getDocumentFile(req.params.id, actor);
    if (!file.buffer && file.link) {
        res.redirect(file.link);
        return;
    }
    if (!file.buffer) {
        res.status(404).json({ status: "error", message: "File dokumen DC tidak ditemukan" });
        return;
    }
    res.setHeader("Content-Type", file.document.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.document.file_name || "dokumen-dc")}"`);
    res.send(file.buffer);
});
