import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { approvalActionSchema } from "../approval/approval.schema";
import { rabListQuerySchema, submitRabSchema } from "./rab.schema";
import { rabService } from "./rab.service";

export const submitRab = asyncHandler(async (req: Request, res: Response) => {
    const payload = submitRabSchema.parse(req.body);
    const data = await rabService.submit(payload);

    res.status(201).json({
        status: "success",
        message: "Pengajuan RAB berhasil disimpan",
        data
    });
});

export const listRab = asyncHandler(async (req: Request, res: Response) => {
    const query = rabListQuerySchema.parse(req.query);
    const data = await rabService.list(query);

    res.json({ status: "success", data });
});

export const getRabById = asyncHandler(async (req: Request, res: Response) => {
    const data = await rabService.getById(req.params.id);

    res.json({ status: "success", data });
});

export const downloadRabPdf = asyncHandler(async (req: Request, res: Response) => {
    const result = await rabService.generatePdf(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.pdfBuffer);
});

export const handleRabApproval = asyncHandler(async (req: Request, res: Response) => {
    const action = approvalActionSchema.parse(req.body);
    const result = await rabService.handleApproval(req.params.id, action);

    res.json({
        status: "success",
        message: "Approval berhasil diproses",
        data: result
    });
});
