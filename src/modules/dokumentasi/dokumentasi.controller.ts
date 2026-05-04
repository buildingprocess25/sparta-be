import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    dokumentasiBangunanCreateSchema,
    dokumentasiBangunanIdParamSchema,
    dokumentasiBangunanItemIdParamSchema,
    dokumentasiBangunanListQuerySchema,
    dokumentasiBangunanUpdateSchema
} from "./dokumentasi.schema";
import { dokumentasiBangunanService, type UploadedDokumentasiFile } from "./dokumentasi.service";

const getUploadedFiles = (req: Request): UploadedDokumentasiFile[] => {
    const files = req.files as UploadedDokumentasiFile[] | undefined;
    if (!files) return [];
    return files;
};

export const createDokumentasiBangunan = asyncHandler(async (req: Request, res: Response) => {
    const payload = dokumentasiBangunanCreateSchema.parse(req.body);
    const files = getUploadedFiles(req);
    const result = await dokumentasiBangunanService.create(payload, files);

    res.json({
        status: "success",
        message: "Dokumentasi bangunan berhasil dibuat",
        data: result
    });
});

export const listDokumentasiBangunan = asyncHandler(async (req: Request, res: Response) => {
    const query = dokumentasiBangunanListQuerySchema.parse(req.query);
    const data = await dokumentasiBangunanService.list(query);

    res.json({
        status: "success",
        data
    });
});

export const getDokumentasiBangunanDetail = asyncHandler(async (req: Request, res: Response) => {
    const params = dokumentasiBangunanIdParamSchema.parse(req.params);
    const data = await dokumentasiBangunanService.getDetail(params.id);

    res.json({
        status: "success",
        data
    });
});

export const updateDokumentasiBangunan = asyncHandler(async (req: Request, res: Response) => {
    const params = dokumentasiBangunanIdParamSchema.parse(req.params);
    const payload = dokumentasiBangunanUpdateSchema.parse(req.body);
    const files = getUploadedFiles(req);
    const data = await dokumentasiBangunanService.update(params.id, payload, files);

    res.json({
        status: "success",
        message: "Dokumentasi bangunan berhasil diperbarui",
        data
    });
});

export const deleteDokumentasiBangunan = asyncHandler(async (req: Request, res: Response) => {
    const params = dokumentasiBangunanIdParamSchema.parse(req.params);
    const data = await dokumentasiBangunanService.delete(params.id);

    res.json({
        status: "success",
        message: "Dokumentasi bangunan berhasil dihapus",
        data
    });
});

export const addDokumentasiBangunanItems = asyncHandler(async (req: Request, res: Response) => {
    const params = dokumentasiBangunanIdParamSchema.parse(req.params);
    const files = getUploadedFiles(req);
    const data = await dokumentasiBangunanService.addItems(params.id, files);

    res.json({
        status: "success",
        message: "Foto dokumentasi berhasil ditambahkan",
        data
    });
});

export const deleteDokumentasiBangunanItem = asyncHandler(async (req: Request, res: Response) => {
    const params = dokumentasiBangunanItemIdParamSchema.parse(req.params);
    const data = await dokumentasiBangunanService.deleteItem(params.itemId);

    res.json({
        status: "success",
        message: "Item dokumentasi berhasil dihapus",
        data
    });
});

export const createDokumentasiBangunanPdf = asyncHandler(async (req: Request, res: Response) => {
    const params = dokumentasiBangunanIdParamSchema.parse(req.params);
    const data = await dokumentasiBangunanService.createPdf(params.id);

    res.json({
        status: "success",
        message: "PDF dokumentasi berhasil dibuat",
        data
    });
});
