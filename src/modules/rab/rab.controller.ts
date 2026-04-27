import type { Request, Response } from "express";
import { AppError } from "../../common/app-error";
import { asyncHandler } from "../../common/async-handler";
import { approvalActionSchema } from "../approval/approval.schema";
import { rabListQuerySchema, submitRabSchema } from "./rab.schema";
import { rabService } from "./rab.service";

export const submitRab = asyncHandler(async (req: Request, res: Response) => {
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
        file_asuransi: typeof req.body.file_asuransi === "string" ? req.body.file_asuransi : undefined,
        rev_logo: typeof req.body.rev_logo === "string" ? req.body.rev_logo : undefined,
        rev_file_asuransi: typeof req.body.rev_file_asuransi === "string" ? req.body.rev_file_asuransi : undefined,
        is_revisi: typeof req.body.is_revisi === "string"
            ? req.body.is_revisi
            : req.body.is_revisi,
        id_rab_revisi: typeof req.body.id_rab_revisi === "string"
            ? req.body.id_rab_revisi
            : req.body.id_rab_revisi,
    };

    // Debug: log raw body toko fields yang diterima dari frontend
    console.log("[RAB SUBMIT] raw body toko fields:", JSON.stringify({
        nomor_ulok: payloadCandidate.nomor_ulok,
        nama_toko: payloadCandidate.nama_toko,
        proyek: payloadCandidate.proyek,
        cabang: payloadCandidate.cabang,
        alamat: payloadCandidate.alamat,
        nama_kontraktor: payloadCandidate.nama_kontraktor,
        lingkup_pekerjaan: payloadCandidate.lingkup_pekerjaan,
    }));
    const payload = submitRabSchema.parse(payloadCandidate);

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

    const uploadedInsuranceFile = getUploadedFile("file_asuransi");
    const uploadedRevInsuranceFile = getUploadedFile("rev_file_asuransi");
    const uploadedRevLogoFile = getUploadedFile("rev_logo");

    console.log("[RAB SUBMIT] parsed toko fields:", JSON.stringify({
        nomor_ulok: payload.nomor_ulok,
        nama_toko: payload.nama_toko,
        proyek: payload.proyek,
        cabang: payload.cabang,
        alamat: payload.alamat,
        nama_kontraktor: payload.nama_kontraktor,
        lingkup_pekerjaan: payload.lingkup_pekerjaan,
    }));
    const data = await rabService.submit(payload, {
        insuranceFile: uploadedInsuranceFile,
        revInsuranceFile: uploadedRevInsuranceFile,
        revLogoFile: uploadedRevLogoFile,
    });

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
    const result = await rabService.getPdfDownloadPayload(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.pdfBuffer);
});

export const downloadRabLogo = asyncHandler(async (req: Request, res: Response) => {
    const result = await rabService.getAssetDownloadPayload(req.params.id, "logo");

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.fileBuffer);
});

export const downloadRabInsuranceFile = asyncHandler(async (req: Request, res: Response) => {
    const result = await rabService.getAssetDownloadPayload(req.params.id, "file_asuransi");

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.fileBuffer);
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
