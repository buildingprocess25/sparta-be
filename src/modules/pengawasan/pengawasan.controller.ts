import type { Request, Response } from "express";
import { AppError } from "../../common/app-error";
import { asyncHandler } from "../../common/async-handler";
import { GoogleProvider } from "../../common/google";
import {
    bulkCreatePengawasanSchema,
    createPengawasanSchema,
    listPengawasanQuerySchema,
    updatePengawasanSchema
} from "./pengawasan.schema";
import { pengawasanService } from "./pengawasan.service";

type UploadedDokumentasiFile = {
    originalname: string;
    mimetype: string;
    buffer: Parameters<GoogleProvider["uploadFile"]>[3];
};

type UploadedFilesMap = Record<string, UploadedDokumentasiFile[]>;

const getUploadedFile = (
    files: UploadedFilesMap | undefined,
    fieldName: "file_dokumentasi" | "rev_file_dokumentasi"
): UploadedDokumentasiFile | undefined => {
    const file = files?.[fieldName]?.[0];
    if (!file) return undefined;

    return {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer
    };
};

const getUploadedFiles = (
    files: UploadedFilesMap | undefined,
    fieldName: "file_dokumentasi" | "rev_file_dokumentasi"
): UploadedDokumentasiFile[] => {
    const fieldFiles = files?.[fieldName] ?? [];
    return fieldFiles.map((file) => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer
    }));
};

export const createPengawasan = asyncHandler(async (req: Request, res: Response) => {
    const payload = createPengawasanSchema.parse(req.body);
    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedDokumentasi = getUploadedFile(uploadedFiles, "file_dokumentasi");
    const data = await pengawasanService.create(payload, uploadedDokumentasi);

    res.status(201).json({
        status: "success",
        message: "Data pengawasan berhasil disimpan",
        data
    });
});

export const createBulkPengawasan = asyncHandler(async (req: Request, res: Response) => {
    let parsedItems = req.body.items;
    if (typeof req.body.items === "string") {
        try {
            parsedItems = JSON.parse(req.body.items);
        } catch {
            throw new AppError("Format items tidak valid. Untuk multipart/form-data kirim items sebagai JSON string.", 400);
        }
    }

    const payloadCandidate = {
        ...req.body,
        items: parsedItems
    };
    const { items } = bulkCreatePengawasanSchema.parse(payloadCandidate);
    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedDokumentasiFiles = getUploadedFiles(uploadedFiles, "file_dokumentasi");
    const data = await pengawasanService.createBulk(items, uploadedDokumentasiFiles);

    res.status(201).json({
        status: "success",
        message: `${data.length} data pengawasan berhasil disimpan`,
        data
    });
});

export const listPengawasan = asyncHandler(async (req: Request, res: Response) => {
    const query = listPengawasanQuerySchema.parse(req.query);
    const data = await pengawasanService.list(query);

    res.json({ status: "success", data });
});

export const getPengawasanById = asyncHandler(async (req: Request, res: Response) => {
    const data = await pengawasanService.getById(req.params.id);
    res.json({ status: "success", data });
});

export const updatePengawasan = asyncHandler(async (req: Request, res: Response) => {
    const payload = updatePengawasanSchema.parse(req.body);
    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedDokumentasi = getUploadedFile(uploadedFiles, "rev_file_dokumentasi");
    const data = await pengawasanService.update(req.params.id, payload, uploadedDokumentasi);

    res.json({
        status: "success",
        message: "Data pengawasan berhasil diperbarui",
        data
    });
});

export const deletePengawasan = asyncHandler(async (req: Request, res: Response) => {
    const data = await pengawasanService.remove(req.params.id);

    res.json({
        status: "success",
        message: "Data pengawasan berhasil dihapus",
        data
    });
});
