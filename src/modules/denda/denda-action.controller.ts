import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    createDendaActionSchema,
    dendaActionIdParamsSchema,
    listDendaActionsQuerySchema,
    rejectDendaActionSchema,
} from "./denda-action.schema";
import { dendaActionService } from "./denda-action.service";

export const listDendaActionKontraktor = asyncHandler(async (req: Request, res: Response) => {
    const data = await dendaActionService.listKontraktor(req.user);

    res.json({
        status: "success",
        data,
    });
});

export const listDendaActionCandidates = asyncHandler(async (_req: Request, res: Response) => {
    const data = await dendaActionService.listCandidates();

    res.json({
        status: "success",
        data,
    });
});

export const listDendaActions = asyncHandler(async (req: Request, res: Response) => {
    const query = listDendaActionsQuerySchema.parse(req.query);
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
        message: "Pengajuan SP/Takeover berhasil ditolak.",
        data,
    });
});
