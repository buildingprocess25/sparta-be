import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
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
    buffer: Buffer;
};

const getUploadedFile = (
    files: Record<string, Express.Multer.File[]> | undefined,
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

export const createPengawasan = asyncHandler(async (req: Request, res: Response) => {
    const payload = createPengawasanSchema.parse(req.body);
    const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
    const uploadedDokumentasi = getUploadedFile(uploadedFiles, "file_dokumentasi");
    const data = await pengawasanService.create(payload, uploadedDokumentasi);

    res.status(201).json({
        status: "success",
        message: "Data pengawasan berhasil disimpan",
        data
    });
});

export const createBulkPengawasan = asyncHandler(async (req: Request, res: Response) => {
    const { items } = bulkCreatePengawasanSchema.parse(req.body);
    const data = await pengawasanService.createBulk(items);

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
    const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
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
