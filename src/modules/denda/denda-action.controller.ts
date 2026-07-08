import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { GoogleProvider } from "../../common/google";
import { AppError } from "../../common/app-error";
import {
    createDendaActionSchema,
    dendaActionIdParamsSchema,
    listDendaActionsQuerySchema,
    rejectDendaActionSchema,
} from "./denda-action.schema";
import { injectBranchFilter } from "../../common/branch-filter-helper";
import { dendaActionService } from "./denda-action.service";

export const listDendaActionKontraktor = asyncHandler(async (req: Request, res: Response) => {
    const data = await dendaActionService.listKontraktor(req.user);

    res.json({
        status: "success",
        data,
    });
});

export const listDendaActionCandidates = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AppError("User tidak terautentikasi", 401);
    }
    const query = await injectBranchFilter(req.user, {} as { cabang_array?: string[] });
    const data = await dendaActionService.listCandidates(query.cabang_array);

    res.json({
        status: "success",
        data,
    });
});

export const listDendaActions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AppError("User tidak terautentikasi", 401);
    }
    let query = listDendaActionsQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user, query);
    const data = await dendaActionService.listActions(query);

    res.json({
        status: "success",
        data,
    });
});

export const createDendaAction = asyncHandler(async (req: Request, res: Response) => {
    const payload = createDendaActionSchema.parse(req.body);
    const attachment = req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer,
        }
        : undefined;

    const data = await dendaActionService.createAction({
        ...payload,
        attachment,
        actor: req.user,
    });

    res.status(201).json({
        status: "success",
        message: payload.action_type === "SP"
            ? "Surat Peringatan berhasil diajukan ke manager."
            : "Takeover berhasil diajukan ke manager.",
        data,
    });
});

export const approveDendaAction = asyncHandler(async (req: Request, res: Response) => {
    const { id } = dendaActionIdParamsSchema.parse(req.params);
    const data = await dendaActionService.approveAction({
        id,
        actor: req.user,
    });

    res.json({
        status: "success",
        message: data.action_type === "SP"
            ? "Surat Peringatan berhasil di-approve dan aktif selama 6 bulan."
            : "Takeover berhasil di-approve sebagai catatan administratif.",
        data,
    });
});

export const rejectDendaAction = asyncHandler(async (req: Request, res: Response) => {
    const { id } = dendaActionIdParamsSchema.parse(req.params);
    const payload = rejectDendaActionSchema.parse(req.body);
    const data = await dendaActionService.rejectAction({
        id,
        payload,
        actor: req.user,
    });

    res.json({
        status: "success",
        message: "Pengajuan berhasil ditolak.",
        data,
    });
});

export const proxyFile = asyncHandler(async (req: Request, res: Response) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) throw new AppError("Missing url parameter", 400);

    const driveFileMatch = rawUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    const driveOpenMatch = rawUrl.match(/drive\.google\.com\/open\?id=([^&]+)/);
    const fileId = driveFileMatch?.[1] ?? driveOpenMatch?.[1];

    if (!fileId) throw new AppError("Invalid Google Drive URL", 400);

    const gp = GoogleProvider.instance;
    if (!gp.spartaDrive) throw new AppError("Google Drive tidak terkonfigurasi", 500);

    try {
        const fileMeta = await gp.spartaDrive.files.get({ fileId, fields: "name, mimeType" });
        res.setHeader("Content-Disposition", `inline; filename="${fileMeta.data.name}"`);
        if (fileMeta.data.mimeType) {
            res.setHeader("Content-Type", fileMeta.data.mimeType);
        }
        
        const stream = await gp.spartaDrive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
        stream.data.pipe(res);
    } catch (e: any) {
        throw new AppError(`Gagal mengambil file dari drive: ${e.message}`, 500);
    }
});
