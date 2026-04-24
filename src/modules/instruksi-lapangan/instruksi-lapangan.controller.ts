import type { Request, Response } from "express";
import { AppError } from "../../common/app-error";
import { asyncHandler } from "../../common/async-handler";
import { approvalActionSchema } from "../approval/approval.schema";
import { listInstruksiLapanganQuerySchema, submitInstruksiLapanganSchema } from "./instruksi-lapangan.schema";
import { instruksiLapanganService } from "./instruksi-lapangan.service";

export const submitInstruksiLapangan = asyncHandler(async (req: Request, res: Response) => {
    let detailItems = req.body.detail_items;
    if (typeof detailItems === "string") {
        try {
            detailItems = JSON.parse(detailItems);
        } catch {
            throw new AppError("Format detail_items tidak valid. Untuk multipart/form-data kirim detail_items sebagai JSON string.", 400);
        }
    }

    const payloadCandidate = {
        ...req.body,
        detail_items: detailItems,
    };

    const payload = submitInstruksiLapanganSchema.parse(payloadCandidate);

    const uploadedFiles = (req.files ?? {}) as Record<string, Array<{
        originalname: string;
        mimetype: string;
        buffer: Buffer;
    }>>;
    const getUploadedFile = (fieldName: string) => {
        const file = uploadedFiles[fieldName]?.[0];
        if (!file) return undefined;

        return {
            originalname: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer
        };
    };

    const uploadedLampiran = getUploadedFile("lampiran");

    const data = await instruksiLapanganService.submit(payload, {
        lampiranFile: uploadedLampiran,
    });

    res.status(201).json({
        status: "success",
        message: "Pengajuan Instruksi Lapangan berhasil disimpan",
        data
    });
});

export const listInstruksiLapangan = asyncHandler(async (req: Request, res: Response) => {
    const query = listInstruksiLapanganQuerySchema.parse(req.query);
    const data = await instruksiLapanganService.list(query);

    res.json({ status: "success", data });
});

export const getInstruksiLapanganById = asyncHandler(async (req: Request, res: Response) => {
    const data = await instruksiLapanganService.getById(req.params.id);

    res.json({ status: "success", data });
});

export const downloadInstruksiLapanganPdf = asyncHandler(async (req: Request, res: Response) => {
    const result = await instruksiLapanganService.getPdfDownloadPayload(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.pdfBuffer);
});

export const downloadInstruksiLapanganLampiran = asyncHandler(async (req: Request, res: Response) => {
    const result = await instruksiLapanganService.getAssetDownloadPayload(req.params.id, "lampiran");

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.fileBuffer);
});

export const handleInstruksiLapanganApproval = asyncHandler(async (req: Request, res: Response) => {
    const action = approvalActionSchema.parse(req.body);
    const result = await instruksiLapanganService.handleApproval(req.params.id, action);

    res.json({
        status: "success",
        message: "Approval berhasil diproses",
        data: result
    });
});
