import type { Request, Response } from "express";
import { AppError } from "../../common/app-error";
import { asyncHandler } from "../../common/async-handler";
import { GoogleProvider } from "../../common/google";
import {
    bulkUpdatePengawasanSchema,
    bulkCreatePengawasanSchema,
    createPengawasanSchema,
    listPengawasanQuerySchema,
    updatePengawasanSchema
} from "./pengawasan.schema";
import { injectBranchFilter } from "../../common/branch-filter-helper";
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

    let parsedDokumentasiIndexes = req.body.file_dokumentasi_indexes;
    if (typeof req.body.file_dokumentasi_indexes === "string") {
        try {
            parsedDokumentasiIndexes = JSON.parse(req.body.file_dokumentasi_indexes);
        } catch {
            throw new AppError(
                "Format file_dokumentasi_indexes tidak valid. Untuk multipart/form-data kirim sebagai JSON string array index.",
                400
            );
        }
    }

    if (typeof parsedDokumentasiIndexes !== "undefined" && !Array.isArray(parsedDokumentasiIndexes)) {
        throw new AppError("file_dokumentasi_indexes harus berupa array index", 400);
    }

    const dokumentasiIndexes = Array.isArray(parsedDokumentasiIndexes)
        ? parsedDokumentasiIndexes.map((value, index) => {
            const numberValue = Number(value);
            if (!Number.isInteger(numberValue) || numberValue < 0) {
                throw new AppError(`file_dokumentasi_indexes[${index}] harus integer >= 0`, 400);
            }
            return numberValue;
        })
        : undefined;

    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedDokumentasiFiles = getUploadedFiles(uploadedFiles, "file_dokumentasi");
    const data = await pengawasanService.createBulk(items, uploadedDokumentasiFiles, dokumentasiIndexes);

    res.status(201).json({
        status: "success",
        message: `${data.length} data pengawasan berhasil disimpan`,
        data
    });
});

export const listPengawasan = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AppError("User tidak terautentikasi", 401);
    }
    
    console.log('[PENGAWASAN LIST] Original request query:', JSON.stringify(req.query));
    console.log('[PENGAWASAN LIST] User info:', {
        email: req.user.email_sat,
        cabang: req.user.cabang,
        roles: req.user.roles
    });
    
    let query = listPengawasanQuerySchema.parse(req.query);
    console.log('[PENGAWASAN LIST] After schema parse:', JSON.stringify(query));
    
    query = await injectBranchFilter(req.user, query);
    console.log('[PENGAWASAN LIST] After inject filter:', JSON.stringify(query));
    
    // Security: Pastikan cabang_array tidak kosong untuk user non-global
    if (!query.cabang_array || query.cabang_array.length === 0) {
        console.error('[PENGAWASAN LIST] REJECT: No branch access');
        throw new AppError("User tidak memiliki akses ke cabang manapun. Hubungi administrator.", 403);
    }
    
    const data = await pengawasanService.list(query);
    console.log('[PENGAWASAN LIST] Result count:', data.length);

    res.json({ status: "success", data });
});

export const listPendingPengawasanMigrationPdfs = asyncHandler(async (req: Request, res: Response) => {
    const nomorUlok = typeof req.query.nomor_ulok === "string" ? req.query.nomor_ulok : undefined;
    const data = await pengawasanService.listPendingMigrationPdfs(nomorUlok);
    res.json({ status: "success", data });
});

export const getPengawasanById = asyncHandler(async (req: Request, res: Response) => {
    const data = await pengawasanService.getById(req.params.id);
    res.json({ status: "success", data });
});

export const downloadPengawasanPdf = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError("ID pengawasan tidak valid", 400);
    }

    const { buffer, filename } = await pengawasanService.downloadPdf(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
});

export const updatePengawasan = asyncHandler(async (req: Request, res: Response) => {
    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedDokumentasi = getUploadedFile(uploadedFiles, "rev_file_dokumentasi");
    const payload = updatePengawasanSchema.parse(req.body);

    if (Object.keys(payload).length === 0 && !uploadedDokumentasi) {
        throw new AppError("Minimal satu field harus diisi untuk update atau kirim rev_file_dokumentasi", 400);
    }

    const data = await pengawasanService.update(req.params.id, payload, uploadedDokumentasi);

    res.json({
        status: "success",
        message: "Data pengawasan berhasil diperbarui",
        data
    });
});

export const updateBulkPengawasan = asyncHandler(async (req: Request, res: Response) => {
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
    const { items } = bulkUpdatePengawasanSchema.parse(payloadCandidate);

    let parsedDokumentasiIndexes = req.body.rev_file_dokumentasi_indexes;
    if (typeof req.body.rev_file_dokumentasi_indexes === "string") {
        try {
            parsedDokumentasiIndexes = JSON.parse(req.body.rev_file_dokumentasi_indexes);
        } catch {
            throw new AppError(
                "Format rev_file_dokumentasi_indexes tidak valid. Untuk multipart/form-data kirim sebagai JSON string array index.",
                400
            );
        }
    }

    if (typeof parsedDokumentasiIndexes !== "undefined" && !Array.isArray(parsedDokumentasiIndexes)) {
        throw new AppError("rev_file_dokumentasi_indexes harus berupa array index", 400);
    }

    const dokumentasiIndexes = Array.isArray(parsedDokumentasiIndexes)
        ? parsedDokumentasiIndexes.map((value, index) => {
            const numberValue = Number(value);
            if (!Number.isInteger(numberValue) || numberValue < 0) {
                throw new AppError(`rev_file_dokumentasi_indexes[${index}] harus integer >= 0`, 400);
            }
            return numberValue;
        })
        : undefined;

    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedDokumentasiFiles = getUploadedFiles(uploadedFiles, "rev_file_dokumentasi");
    const data = await pengawasanService.updateBulk(items, uploadedDokumentasiFiles, dokumentasiIndexes);

    res.json({
        status: "success",
        message: `${data.length} data pengawasan berhasil diperbarui`,
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
