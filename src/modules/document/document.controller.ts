import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { loginDocSchema, saveDocumentSchema, updateDocumentSchema } from "./document.schema";
import * as documentService from "./document.service";

// POST /api/doc/login
export const loginDoc = asyncHandler(async (req: Request, res: Response) => {
    const payload = loginDocSchema.parse(req.body);
    const result = await documentService.loginDoc(payload);
    res.json(result);
});

// GET /api/doc/list
export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
    const cabang = typeof req.query.cabang === "string" ? req.query.cabang : undefined;
    const result = await documentService.listDocuments(cabang);
    res.json(result);
});

// POST /api/doc/save
export const saveDocument = asyncHandler(async (req: Request, res: Response) => {
    const payload = saveDocumentSchema.parse(req.body);
    const result = await documentService.saveDocument(payload);
    res.json(result);
});

// PUT /api/doc/update/:kodeToko
export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
    const kodeToko = req.params.kodeToko;
    const payload = updateDocumentSchema.parse(req.body);
    const result = await documentService.updateDocument(kodeToko, payload);
    res.json(result);
});

// DELETE /api/doc/delete/:kodeToko
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
    const kodeToko = req.params.kodeToko;
    const result = await documentService.deleteDocument(kodeToko);
    res.json(result);
});

// GET /api/doc/detail/:kodeToko
export const getDocumentDetail = asyncHandler(async (req: Request, res: Response) => {
    const kodeToko = req.params.kodeToko;
    const result = await documentService.getDocumentDetail(kodeToko);
    res.json(result);
});
