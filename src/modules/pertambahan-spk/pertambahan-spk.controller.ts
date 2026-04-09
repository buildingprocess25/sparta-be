import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    createPertambahanSpkSchema,
    pertambahanSpkApprovalSchema,
    pertambahanSpkListQuerySchema,
    updatePertambahanSpkSchema
} from "./pertambahan-spk.schema";
import { pertambahanSpkService } from "./pertambahan-spk.service";

export const createPertambahanSpk = asyncHandler(async (req: Request, res: Response) => {
    const payload = createPertambahanSpkSchema.parse(req.body);
    const uploadedLampiranPendukung = req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer
        }
        : undefined;

    const data = await pertambahanSpkService.create(payload, uploadedLampiranPendukung);

    res.status(201).json({
        status: "success",
        message: "Data pertambahan SPK berhasil dibuat",
        data
    });
});

export const listPertambahanSpk = asyncHandler(async (req: Request, res: Response) => {
    const query = pertambahanSpkListQuerySchema.parse(req.query);
    const data = await pertambahanSpkService.list(query);

    res.json({ status: "success", data });
});

export const getPertambahanSpkById = asyncHandler(async (req: Request, res: Response) => {
    const data = await pertambahanSpkService.getById(req.params.id);

    res.json({ status: "success", data });
});

export const downloadPertambahanSpkPdf = asyncHandler(async (req: Request, res: Response) => {
    const result = await pertambahanSpkService.getDownloadPayload(req.params.id, "link_pdf");

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.fileBuffer);
});

export const downloadPertambahanSpkLampiranPendukung = asyncHandler(async (req: Request, res: Response) => {
    const result = await pertambahanSpkService.getDownloadPayload(req.params.id, "link_lampiran_pendukung");

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.fileBuffer);
});

export const updatePertambahanSpkById = asyncHandler(async (req: Request, res: Response) => {
    const payload = updatePertambahanSpkSchema.parse(req.body);
    const uploadedLampiranPendukung = req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer
        }
        : undefined;

    const data = await pertambahanSpkService.updateById(req.params.id, payload, uploadedLampiranPendukung);

    res.json({
        status: "success",
        message: "Data pertambahan SPK berhasil diperbarui",
        data
    });
});

export const deletePertambahanSpkById = asyncHandler(async (req: Request, res: Response) => {
    await pertambahanSpkService.deleteById(req.params.id);

    res.json({
        status: "success",
        message: "Data pertambahan SPK berhasil dihapus"
    });
});

export const handlePertambahanSpkApproval = asyncHandler(async (req: Request, res: Response) => {
    const action = pertambahanSpkApprovalSchema.parse(req.body);
    const data = await pertambahanSpkService.handleApproval(req.params.id, action);

    res.json({
        status: "success",
        message: "Approval pertambahan SPK berhasil diproses",
        data
    });
});
