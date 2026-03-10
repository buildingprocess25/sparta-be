import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    loginDokumentasiSchema,
    spkDataSchema,
    saveTempSchema,
    getTempSchema,
    cekStatusSchema,
    saveTokoSchema,
    sendPdfEmailSchema,
    validateQuerySchema,
} from "./dokumentasi.schema";
import * as dokumentasiService from "./dokumentasi.service";

export const loginDokumentasi = asyncHandler(async (req: Request, res: Response) => {
    const payload = loginDokumentasiSchema.parse(req.body);
    const result = await dokumentasiService.loginDokumentasi(payload);
    res.json(result);
});

export const spkData = asyncHandler(async (req: Request, res: Response) => {
    const payload = spkDataSchema.parse(req.body);
    const result = await dokumentasiService.spkData(payload);
    res.json(result);
});

export const viewPhoto = asyncHandler(async (req: Request, res: Response) => {
    const fileId = req.params.fileId;
    const result = await dokumentasiService.viewPhoto(fileId);
    if (!result) {
        return res.status(404).send("Not Found");
    }
    res.setHeader("Content-Type", "image/jpeg");
    return res.send(result);
});

export const saveTemp = asyncHandler(async (req: Request, res: Response) => {
    const payload = saveTempSchema.parse(req.body);
    const result = await dokumentasiService.saveTemp(payload);
    res.json(result);
});

export const getTemp = asyncHandler(async (req: Request, res: Response) => {
    const payload = getTempSchema.parse(req.body);
    const result = await dokumentasiService.getTemp(payload);
    res.json(result);
});

export const cekStatus = asyncHandler(async (req: Request, res: Response) => {
    const payload = cekStatusSchema.parse(req.body);
    const result = await dokumentasiService.cekStatus(payload);
    res.json(result);
});

export const saveToko = asyncHandler(async (req: Request, res: Response) => {
    const payload = saveTokoSchema.parse(req.body);
    const result = await dokumentasiService.saveToko(payload);
    res.json(result);
});

export const sendPdfEmail = asyncHandler(async (req: Request, res: Response) => {
    const payload = sendPdfEmailSchema.parse(req.body);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await dokumentasiService.sendPdfEmail(payload, baseUrl);
    res.json(result);
});

export const validateDokumentasi = asyncHandler(async (req: Request, res: Response) => {
    const payload = validateQuerySchema.parse(req.query);
    const result = await dokumentasiService.validateDokumentasi(payload);
    res.status(result.statusCode).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(result.html);
});
