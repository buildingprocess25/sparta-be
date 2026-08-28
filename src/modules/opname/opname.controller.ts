import type { Request, Response } from "express";
import { AppError } from "../../common/app-error";
import { asyncHandler } from "../../common/async-handler";
import { GoogleProvider } from "../../common/google";
import {
    bulkCreateOpnameSchema,
    contractorCheckpointOpnameSubmitSchema,
    contractorOpnameRevisionSchema,
    createOpnameSchema,
    listOpnameQuerySchema,
    supportOpnameReviewDecisionSchema,
    updateOpnameSchema
} from "./opname.schema";
import { opnameService, uploadFotoOpnameToDrive } from "./opname.service";

type UploadedFotoOpnameFile = {
    originalname: string;
    mimetype: string;
    buffer: Parameters<GoogleProvider["uploadFile"]>[3];
};

type UploadedFilesMap = Record<string, UploadedFotoOpnameFile[]>;

const getUploadedFile = (
    files: UploadedFilesMap | UploadedFotoOpnameFile[] | undefined,
    fieldName: "file_foto_opname" | "rev_file_foto_opname"
): UploadedFotoOpnameFile | undefined => {
    const file = Array.isArray(files)
        ? (files as any[]).find((item) => item.fieldname === fieldName)
        : files?.[fieldName]?.[0];
    if (!file) return undefined;

    return {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer
    };
};

const getUploadedFiles = (
    files: UploadedFilesMap | UploadedFotoOpnameFile[] | undefined,
    fieldName: "file_foto_opname" | "rev_file_foto_opname"
): UploadedFotoOpnameFile[] => {
    const fieldFiles = Array.isArray(files)
        ? (files as any[]).filter((item) => item.fieldname === fieldName)
        : files?.[fieldName] ?? [];
    return fieldFiles.map((file) => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer
    }));
};


const parseJsonField = (value: unknown, fieldName: string): unknown => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        throw new AppError("Format " + fieldName + " tidak valid. Kirim sebagai JSON string.", 400);
    }
};

const parseIndexArrayField = (value: unknown, fieldName: string): number[] | undefined => {
    const parsed = typeof value === "string" ? parseJsonField(value, fieldName) : value;
    if (typeof parsed === "undefined" || parsed === null || parsed === "") return undefined;
    if (!Array.isArray(parsed)) throw new AppError(fieldName + " harus berupa array index", 400);
    return parsed.map((item, index) => {
        const numberValue = Number(item);
        if (!Number.isInteger(numberValue) || numberValue < 0) {
            throw new AppError(fieldName + "[" + index + "] harus integer >= 0", 400);
        }
        return numberValue;
    });
};

export const createOpname = asyncHandler(async (req: Request, res: Response) => {
    const payload = createOpnameSchema.parse(req.body);
    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedFotoOpname = getUploadedFile(uploadedFiles, "file_foto_opname");
    const data = await opnameService.create(payload, uploadedFotoOpname);

    res.status(201).json({
        status: "success",
        message: "Data opname berhasil disimpan",
        data
    });
});

export const createBulkOpname = asyncHandler(async (req: Request, res: Response) => {
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
    const {
        id_toko,
        email_pembuat,
        tipe_opname,
        grand_total_opname,
        grand_total_rab,
        items
    } = bulkCreateOpnameSchema.parse(payloadCandidate);

    let parsedFotoIndexes = req.body.file_foto_opname_indexes;
    if (typeof req.body.file_foto_opname_indexes === "string") {
        try {
            parsedFotoIndexes = JSON.parse(req.body.file_foto_opname_indexes);
        } catch {
            throw new AppError(
                "Format file_foto_opname_indexes tidak valid. Untuk multipart/form-data kirim sebagai JSON string array index.",
                400
            );
        }
    }

    if (typeof parsedFotoIndexes !== "undefined" && !Array.isArray(parsedFotoIndexes)) {
        throw new AppError("file_foto_opname_indexes harus berupa array index", 400);
    }

    const fotoIndexes = Array.isArray(parsedFotoIndexes)
        ? parsedFotoIndexes.map((value, index) => {
            const numberValue = Number(value);
            if (!Number.isInteger(numberValue) || numberValue < 0) {
                throw new AppError(`file_foto_opname_indexes[${index}] harus integer >= 0`, 400);
            }
            return numberValue;
        })
        : undefined;

    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedFotoOpnameFiles = getUploadedFiles(uploadedFiles, "file_foto_opname");
    const data = await opnameService.createBulk(
        { id_toko, tipe_opname, email_pembuat, grand_total_opname, grand_total_rab, items },
        uploadedFotoOpnameFiles,
        fotoIndexes
    );

    res.status(201).json({
        status: "success",
        message: `${data.items.length} data opname berhasil disimpan`,
        data
    });
});

export const createCheckpointOpname = asyncHandler(async (req: Request, res: Response) => {
    const rawData = typeof req.body.data !== "undefined" ? parseJsonField(req.body.data, "data") : req.body;
    const payloadCandidate = {
        ...(rawData as Record<string, unknown>),
        items: parseJsonField((rawData as Record<string, unknown>).items, "items")
    } as Record<string, unknown> & { items: unknown[] };

    const uploadedFiles = req.files as UploadedFilesMap | UploadedFotoOpnameFile[] | undefined;
    const uploadedFotoOpnameFiles = getUploadedFiles(uploadedFiles, "file_foto_opname");
    if (uploadedFotoOpnameFiles.length > 0) {
        if (!Array.isArray(payloadCandidate.items)) {
            throw new AppError("items harus berupa array untuk upload foto opname", 400);
        }

        const fotoIndexes = parseIndexArrayField(req.body.file_foto_opname_indexes, "file_foto_opname_indexes")
            ?? uploadedFotoOpnameFiles.map((_, index) => index);
        if (fotoIndexes.length !== uploadedFotoOpnameFiles.length) {
            throw new AppError("Jumlah file_foto_opname_indexes harus sama dengan jumlah file_foto_opname", 400);
        }

        for (let filePosition = 0; filePosition < uploadedFotoOpnameFiles.length; filePosition++) {
            const itemIndex = fotoIndexes[filePosition];
            if (itemIndex < 0 || itemIndex >= payloadCandidate.items.length) {
                throw new AppError("file_foto_opname_indexes[" + filePosition + "] di luar range items (0-" + (payloadCandidate.items.length - 1) + ")", 400);
            }
            const currentItem = payloadCandidate.items[itemIndex] as Record<string, unknown>;
            payloadCandidate.items[itemIndex] = {
                ...currentItem,
                foto: await uploadFotoOpnameToDrive(Number(payloadCandidate.id_toko), uploadedFotoOpnameFiles[filePosition])
            };
        }
    }

    const payload = contractorCheckpointOpnameSubmitSchema.parse(payloadCandidate);
    const data = await opnameService.submitContractorCheckpointOpname(payload, req.user ?? null);

    res.status(201).json({
        status: "success",
        message: "Opname kontraktor berhasil disimpan",
        data
    });
});

export const listContractorFirstOpname = asyncHandler(async (req: Request, res: Response) => {
    const query = listOpnameQuerySchema.parse(req.query);
    const { toko, items, instruksi_lapangan_items } = await opnameService.listContractorFirst(query);

    res.json({ status: "success", toko, instruksi_lapangan_items, data: items });
});

export const reviewContractorFirstOpname = asyncHandler(async (req: Request, res: Response) => {
    const payload = supportOpnameReviewDecisionSchema.parse({
        ...req.body,
        id_opname_item: req.params.id
    });
    const data = await opnameService.reviewContractorFirstOpnameItem(req.params.id, payload, req.user ?? null);

    res.json({
        status: "success",
        message: "Review opname kontraktor berhasil disimpan",
        data
    });
});

export const reviseContractorFirstOpname = asyncHandler(async (req: Request, res: Response) => {
    const uploadedFiles = req.files as UploadedFilesMap | UploadedFotoOpnameFile[] | undefined;
    const uploadedFotoOpname = getUploadedFile(uploadedFiles, "file_foto_opname") ?? getUploadedFile(uploadedFiles, "rev_file_foto_opname");
    const payload = contractorOpnameRevisionSchema.parse(req.body);
    const data = await opnameService.reviseContractorFirstOpnameItem(req.params.id, payload, req.user ?? null, uploadedFotoOpname);

    res.json({
        status: "success",
        message: "Revisi opname kontraktor berhasil disimpan",
        data
    });
});
export const listOpname = asyncHandler(async (req: Request, res: Response) => {
    const query = listOpnameQuerySchema.parse(req.query);
    const { toko, items, instruksi_lapangan_items } = await opnameService.list(query);

    res.json({ status: "success", toko, instruksi_lapangan_items, data: items });
});

export const getOpnameById = asyncHandler(async (req: Request, res: Response) => {
    const data = await opnameService.getById(req.params.id);
    res.json({ status: "success", data });
});

export const downloadOpnameFoto = asyncHandler(async (req: Request, res: Response) => {
    const result = await opnameService.getFotoDownloadPayload(req.params.id);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.fileBuffer);
});

export const updateOpname = asyncHandler(async (req: Request, res: Response) => {
    const payload = updateOpnameSchema.parse(req.body);
    const uploadedFiles = req.files as UploadedFilesMap | undefined;
    const uploadedFotoOpname = getUploadedFile(uploadedFiles, "rev_file_foto_opname");
    const data = await opnameService.update(req.params.id, payload, uploadedFotoOpname);

    res.json({
        status: "success",
        message: "Data opname berhasil diperbarui",
        data
    });
});

export const deleteOpname = asyncHandler(async (req: Request, res: Response) => {
    const data = await opnameService.remove(req.params.id);

    res.json({
        status: "success",
        message: "Data opname berhasil dihapus",
        data
    });
});

