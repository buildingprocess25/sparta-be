import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { approvalActionSchema } from "../approval/approval.schema";
import { rabListQuerySchema, submitRabSchema } from "./rab.schema";
import { rabService } from "./rab.service";

export const submitRab = asyncHandler(async (req: Request, res: Response) => {
    // Debug: log raw body toko fields yang diterima dari frontend
    console.log("[RAB SUBMIT] raw body toko fields:", JSON.stringify({
        nomor_ulok: req.body.nomor_ulok,
        nama_toko: req.body.nama_toko,
        kode_toko: req.body.kode_toko,
        proyek: req.body.proyek,
        cabang: req.body.cabang,
        alamat: req.body.alamat,
        nama_kontraktor: req.body.nama_kontraktor,
        lingkup_pekerjaan: req.body.lingkup_pekerjaan,
    }));
    const payload = submitRabSchema.parse(req.body);
    console.log("[RAB SUBMIT] parsed toko fields:", JSON.stringify({
        nomor_ulok: payload.nomor_ulok,
        nama_toko: payload.nama_toko,
        kode_toko: payload.kode_toko,
        proyek: payload.proyek,
        cabang: payload.cabang,
        alamat: payload.alamat,
        nama_kontraktor: payload.nama_kontraktor,
        lingkup_pekerjaan: payload.lingkup_pekerjaan,
    }));
    const data = await rabService.submit(payload);

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
    const result = await rabService.getPdfDownloadLink(req.params.id);
    res.redirect(result.downloadUrl);
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
