import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    penyimpananDokumenCreateSchema,
    penyimpananDokumenIdParamSchema,
    penyimpananDokumenListQuerySchema,
    penyimpananDokumenUpdateSchema
} from "./document.schema";
import { penyimpananDokumenService, type UploadedDokumenFile } from "./document.service";

const getUploadedFiles = (req: Request): UploadedDokumenFile[] => {
    const files = req.files as UploadedDokumenFile[] | undefined;
    if (!files) return [];
    return files;
};

export const createPenyimpananDokumen = asyncHandler(async (req: Request, res: Response) => {
    const payload = penyimpananDokumenCreateSchema.parse(req.body);
    const files = getUploadedFiles(req);
    const result = await penyimpananDokumenService.create(payload, files);

    res.json({
        status: "success",
        message: "Dokumen berhasil disimpan",
        data: result
    });
});

export const listPenyimpananDokumen = asyncHandler(async (req: Request, res: Response) => {
    const query = penyimpananDokumenListQuerySchema.parse(req.query);
    const data = await penyimpananDokumenService.list(query);

    res.json({
        status: "success",
        data
    });
});

export const getPenyimpananDokumenDetail = asyncHandler(async (req: Request, res: Response) => {
    const params = penyimpananDokumenIdParamSchema.parse(req.params);
    const data = await penyimpananDokumenService.getDetail(params.id);

    res.json({
        status: "success",
        data
    });
});

export const updatePenyimpananDokumen = asyncHandler(async (req: Request, res: Response) => {
    const params = penyimpananDokumenIdParamSchema.parse(req.params);
    const payload = penyimpananDokumenUpdateSchema.parse(req.body);
    const files = getUploadedFiles(req);
    const data = await penyimpananDokumenService.update(params.id, payload, files);

    res.json({
        status: "success",
        message: "Dokumen berhasil diperbarui",
        data
    });
});

export const deletePenyimpananDokumen = asyncHandler(async (req: Request, res: Response) => {
    const params = penyimpananDokumenIdParamSchema.parse(req.params);
    const data = await penyimpananDokumenService.delete(params.id);

    res.json({
        status: "success",
        message: "Dokumen berhasil dihapus",
        data
    });
});
