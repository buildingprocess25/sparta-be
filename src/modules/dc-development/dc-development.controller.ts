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
    dcTenderListQuerySchema,
    inviteDcTenderParticipantSchema,
    submitDcTenderSubmissionSchema,
    setDcTenderWinnerSchema,
    createDcTimelineSchema,
    updateDcTimelineSchema,
    createDcIssueSchema,
    updateDcIssueSchema,
    createDcBastSchema,
    updateDcBastSchema,
    createDcTermScheduleSchema,
    submitDcTermClaimSchema,
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

export const listDcTenders = asyncHandler(async (req: Request, res: Response) => {
    const query = dcTenderListQuerySchema.parse(req.query);
    const data = await dcDevelopmentService.listTenders(query);
    res.json({ status: "success", data });
});

export const getDcTenderById = asyncHandler(async (req: Request, res: Response) => {
    const data = await dcDevelopmentService.getTenderById(req.params.id);
    res.json({ status: "success", data });
});

export const inviteDcTenderParticipant = asyncHandler(async (req: Request, res: Response) => {
    const input = inviteDcTenderParticipantSchema.parse(req.body);
    const data = await dcDevelopmentService.inviteTenderParticipant(req.params.id, input);
    res.status(201).json({
        status: "success",
        message: "Vendor berhasil diundang ke tender",
        data
    });
});

export const submitDcTenderSubmission = asyncHandler(async (req: Request, res: Response) => {
    const input = submitDcTenderSubmissionSchema.parse(req.body);
    // Allow participant_id from body if exists (for internal user testing)
    const data = await dcDevelopmentService.submitTenderSubmission(req.params.id, { ...input, participant_id: req.body.participant_id });
    res.status(201).json({
        status: "success",
        message: "Penawaran tender berhasil disubmit",
        data
    });
});

export const setDcTenderWinner = asyncHandler(async (req: Request, res: Response) => {
    const input = setDcTenderWinnerSchema.parse(req.body);
    const data = await dcDevelopmentService.setTenderWinner(req.params.id, input);
    res.json({
        status: "success",
        message: "Pemenang tender berhasil ditetapkan",
        data
    });
});

export const listDcProjectTimelines = asyncHandler(async (req: Request, res: Response) => {
    const data = await dcDevelopmentService.listProjectTimelines(req.params.id);
    res.json({ status: "success", data });
});

export const addDcProjectTimeline = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcTimelineSchema.parse(req.body);
    const data = await dcDevelopmentService.addProjectTimeline(req.params.id, input);
    res.status(201).json({
        status: "success",
        message: "Task timeline berhasil ditambahkan",
        data
    });
});

export const updateDcProjectTimeline = asyncHandler(async (req: Request, res: Response) => {
    const input = updateDcTimelineSchema.parse(req.body);
    const data = await dcDevelopmentService.updateProjectTimeline(req.params.taskId, input);
    res.json({
        status: "success",
        message: "Task timeline berhasil diupdate",
        data
    });
});

export const listDcProjectIssues = asyncHandler(async (req: Request, res: Response) => {
    const data = await dcDevelopmentService.listProjectIssues(req.params.id);
    res.json({ status: "success", data });
});

export const addDcProjectIssue = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcIssueSchema.parse(req.body);
    const data = await dcDevelopmentService.addProjectIssue(req.params.id, input);
    res.status(201).json({
        status: "success",
        message: "Issue berhasil dilaporkan",
        data
    });
});

export const updateDcProjectIssue = asyncHandler(async (req: Request, res: Response) => {
    const input = updateDcIssueSchema.parse(req.body);
    const data = await dcDevelopmentService.updateProjectIssue(req.params.issueId, input);
    res.json({
        status: "success",
        message: "Issue berhasil diupdate",
        data
    });
});

export const listDcProjectBast = asyncHandler(async (req: Request, res: Response) => {
    const data = await dcDevelopmentService.listProjectBast(req.params.id);
    res.json({ status: "success", data });
});

export const createDcProjectBast = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcBastSchema.parse(req.body);
    const data = await dcDevelopmentService.createProjectBast(req.params.id, input);
    res.status(201).json({
        status: "success",
        message: "BAST berhasil dibuat",
        data
    });
});

export const updateDcProjectBast = asyncHandler(async (req: Request, res: Response) => {
    const input = updateDcBastSchema.parse(req.body);
    const data = await dcDevelopmentService.updateProjectBast(req.params.bastId, input);
    res.json({
        status: "success",
        message: "BAST berhasil diupdate",
        data
    });
});

export const listDcParticipantTerms = asyncHandler(async (req: Request, res: Response) => {
    const data = await dcDevelopmentService.listParticipantTerms(req.params.participantId);
    res.json({ status: "success", data });
});

export const addDcTermSchedule = asyncHandler(async (req: Request, res: Response) => {
    const input = createDcTermScheduleSchema.parse(req.body);
    const data = await dcDevelopmentService.addTermSchedule(req.params.participantId, input);
    res.status(201).json({
        status: "success",
        message: "Jadwal Termin berhasil ditambahkan",
        data
    });
});

export const submitDcTermClaim = asyncHandler(async (req: Request, res: Response) => {
    const input = submitDcTermClaimSchema.parse(req.body);
    const data = await dcDevelopmentService.submitTermClaim(req.params.termId, input);
    res.status(201).json({
        status: "success",
        message: "Klaim Termin berhasil diajukan",
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
