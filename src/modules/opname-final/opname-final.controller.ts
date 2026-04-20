import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { approvalActionSchema } from "../approval/approval.schema";
import { opnameFinalListQuerySchema } from "./opname-final.schema";
import { opnameFinalService } from "./opname-final.service";

export const listOpnameFinal = asyncHandler(async (req: Request, res: Response) => {
    const query = opnameFinalListQuerySchema.parse(req.query);
    const data = await opnameFinalService.list(query);

    res.json({ status: "success", data });
});

export const getOpnameFinalById = asyncHandler(async (req: Request, res: Response) => {
    const data = await opnameFinalService.getById(req.params.id);

    res.json({ status: "success", data });
});

export const handleOpnameFinalApproval = asyncHandler(async (req: Request, res: Response) => {
    const action = approvalActionSchema.parse(req.body);
    const data = await opnameFinalService.handleApproval(req.params.id, action);

    res.json({
        status: "success",
        message: "Approval opname_final berhasil diproses",
        data
    });
});

export const downloadOpnameFinalPdf = asyncHandler(async (req: Request, res: Response) => {
    const result = await opnameFinalService.generatePdf(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.pdfBuffer);
});
