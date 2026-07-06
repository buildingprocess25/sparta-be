import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { createDendaActionSchema, listDendaActionsQuerySchema } from "./denda-action.schema";
import { dendaActionService } from "./denda-action.service";

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
    const data = await dendaActionService.createAction({
        ...payload,
        actor: req.user,
    });

    res.status(201).json({
        status: "success",
        message: payload.action_type === "SP"
            ? "Keputusan Surat Peringatan berhasil disimpan."
            : "Keputusan Takeover berhasil disimpan.",
        data,
    });
});
