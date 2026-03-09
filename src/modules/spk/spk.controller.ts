import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { spkApprovalSchema, spkListQuerySchema, submitSpkSchema } from "./spk.schema";
import { spkService } from "./spk.service";

export const submitSpk = asyncHandler(async (req: Request, res: Response) => {
    const payload = submitSpkSchema.parse(req.body);
    const data = await spkService.submit(payload);

    res.status(201).json({
        status: "success",
        message: "Pengajuan SPK berhasil disimpan",
        data
    });
});

export const listSpk = asyncHandler(async (req: Request, res: Response) => {
    const query = spkListQuerySchema.parse(req.query);
    const data = await spkService.list(query);

    res.json({ status: "success", data });
});

export const getSpkById = asyncHandler(async (req: Request, res: Response) => {
    const data = await spkService.getById(req.params.id);

    res.json({ status: "success", data });
});

export const downloadSpkPdf = asyncHandler(async (req: Request, res: Response) => {
    const result = await spkService.generatePdf(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.pdfBuffer);
});

export const handleSpkApproval = asyncHandler(async (req: Request, res: Response) => {
    const action = spkApprovalSchema.parse(req.body);
    const result = await spkService.handleApproval(req.params.id, action);

    res.json({
        status: "success",
        message: "Approval SPK berhasil diproses",
        data: result
    });
});
