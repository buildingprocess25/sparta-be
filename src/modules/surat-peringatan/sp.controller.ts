import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { GoogleProvider } from "../../common/google";
import { AppError } from "../../common/app-error";
import {
    createDendaActionSchema,
    dendaActionIdParamsSchema,
    listDendaActionsQuerySchema,
    rejectDendaActionSchema,
} from "./sp.schema";
import { injectBranchFilter } from "../../common/branch-filter-helper";
import { spService } from "./sp.service";

export const listDendaActionKontraktor = asyncHandler(async (req: Request, res: Response) => {
    const data = await spService.listKontraktor(req.user);

    res.json({
        status: "success",
        data,
    });
});

export const listDendaActionCandidates = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AppError("User tidak terautentikasi", 401);
    }
    const query = await injectBranchFilter(req.user, {} as { cabang_array?: string[] });
    const data = await spService.listCandidates(query.cabang_array);

    res.json({
        status: "success",
        data,
    });
});

export const listDendaActions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AppError("User tidak terautentikasi", 401);
    }
    let query = listDendaActionsQuerySchema.parse(req.query);
    query = await injectBranchFilter(req.user, query);
    const data = await spService.listActions(query);

    res.json({
        status: "success",
        data,
    });
});

export const createDendaAction = asyncHandler(async (req: Request, res: Response) => {
    const payload = createDendaActionSchema.parse(req.body);
    const attachment = req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer,
        }
        : undefined;

    const data = await spService.createAction({
        ...payload,
        attachment,
        actor: req.user,
    });

    res.status(201).json({
        status: "success",
        message: payload.action_type === "SP"
            ? "Surat Peringatan berhasil diajukan ke manager."
            : "Takeover berhasil diajukan ke manager.",
        data,
    });
});

export const approveDendaAction = asyncHandler(async (req: Request, res: Response) => {
    const { id } = dendaActionIdParamsSchema.parse(req.params);
    const data = await spService.approveAction({
        id,
        actor: req.user,
    });

    res.json({
        status: "success",
        message: data.action_type === "SP"
            ? "Surat Peringatan berhasil di-approve dan aktif selama 6 bulan."
            : "Takeover berhasil di-approve sebagai catatan administratif.",
        data,
    });
});

export const rejectDendaAction = asyncHandler(async (req: Request, res: Response) => {
    const { id } = dendaActionIdParamsSchema.parse(req.params);
    const payload = rejectDendaActionSchema.parse(req.body);
    const data = await spService.rejectAction({
        id,
        payload,
        actor: req.user,
    });

    res.json({
        status: "success",
        message: "Pengajuan berhasil ditolak.",
        data,
    });
});

export const proxyFile = asyncHandler(async (req: Request, res: Response) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) throw new AppError("Missing url parameter", 400);

    // Extract file ID dari berbagai format Google Drive URL
    const driveFileMatch = rawUrl.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
    const driveOpenMatch = rawUrl.match(/drive\.google\.com\/open\?id=([^&]+)/);
    const viewMatch = rawUrl.match(/id=([^&]+)/);
    const fileId = driveFileMatch?.[1] ?? driveOpenMatch?.[1] ?? viewMatch?.[1];

    if (!fileId) {
        console.error("[proxyFile] Invalid URL format:", rawUrl);
        throw new AppError("Invalid Google Drive URL format", 400);
    }

    const gp = GoogleProvider.instance;
    if (!gp.spartaDrive) {
        console.error("[proxyFile] Google Drive not configured");
        throw new AppError("Google Drive tidak terkonfigurasi", 500);
    }

    try {
        console.log(`[proxyFile] Fetching file metadata: ${fileId}`);
        
        // Get file metadata with supportsAllDrives untuk akses Shared Drive
        const fileMeta = await gp.spartaDrive.files.get({ 
            fileId, 
            fields: "name, mimeType, size",
            supportsAllDrives: true 
        });

        console.log(`[proxyFile] File found: ${fileMeta.data.name}, type: ${fileMeta.data.mimeType}, size: ${fileMeta.data.size}`);

        // Set headers
        const filename = fileMeta.data.name || "document";
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        
        if (fileMeta.data.mimeType) {
            res.setHeader("Content-Type", fileMeta.data.mimeType);
        }

        if (fileMeta.data.size) {
            res.setHeader("Content-Length", fileMeta.data.size);
        }

        // Set CORS headers untuk iframe/direct view
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET");
        res.setHeader("Cache-Control", "public, max-age=3600");

        console.log(`[proxyFile] Streaming file content: ${fileId}`);
        
        // Stream file content dengan supportsAllDrives
        const stream = await gp.spartaDrive.files.get(
            { 
                fileId, 
                alt: "media",
                supportsAllDrives: true 
            }, 
            { responseType: "stream" }
        );

        // Handle stream errors
        stream.data.on("error", (error: any) => {
            console.error(`[proxyFile] Stream error for ${fileId}:`, error);
            if (!res.headersSent) {
                res.status(500).json({ 
                    status: "error", 
                    message: "Error streaming file from Drive" 
                });
            }
        });

        stream.data.on("end", () => {
            console.log(`[proxyFile] Successfully streamed: ${fileId}`);
        });

        stream.data.pipe(res);

    } catch (e: any) {
        const status = e?.code ?? e?.response?.status ?? 500;
        const message = e?.message ?? "Unknown error";
        
        console.error(`[proxyFile] Error for fileId ${fileId}:`, {
            status,
            message,
            details: e?.response?.data ?? e
        });

        // Specific error messages
        if (status === 404) {
            throw new AppError("File tidak ditemukan di Google Drive", 404);
        } else if (status === 403) {
            throw new AppError("Akses ke file ditolak. Periksa permission file di Google Drive.", 403);
        } else if (status === 401) {
            throw new AppError("Token Google Drive expired. Silakan refresh token.", 401);
        } else {
            throw new AppError(`Gagal mengambil file dari Drive: ${message}`, status);
        }
    }
});

// ===================================================================
// KONTRAKTOR ENDPOINTS
// ===================================================================

export const listKontraktorSp = asyncHandler(async (req: Request, res: Response) => {
    const namaKontraktor = req.query.nama_kontraktor as string;
    if (!namaKontraktor) {
        throw new AppError("Parameter nama_kontraktor wajib diisi", 400);
    }

    const data = await spService.listKontraktorSp(namaKontraktor);

    res.json({
        status: "success",
        data,
    });
});

export const getKontraktorSpDetail = asyncHandler(async (req: Request, res: Response) => {
    const { id } = dendaActionIdParamsSchema.parse(req.params);
    const namaKontraktor = req.query.nama_kontraktor as string;
    
    if (!namaKontraktor) {
        throw new AppError("Parameter nama_kontraktor wajib diisi", 400);
    }

    const data = await spService.getKontraktorSpDetail({
        id,
        namaKontraktor,
        autoMarkAsViewed: true, // Auto-track view
    });

    res.json({
        status: "success",
        data,
    });
});

export const acknowledgeKontraktorSp = asyncHandler(async (req: Request, res: Response) => {
    const { id } = dendaActionIdParamsSchema.parse(req.params);
    const namaKontraktor = req.query.nama_kontraktor as string;
    
    if (!namaKontraktor) {
        throw new AppError("Parameter nama_kontraktor wajib diisi", 400);
    }

    const { catatan_acknowledge } = req.body;

    const data = await spService.acknowledgeKontraktorSp({
        id,
        namaKontraktor,
        catatan: catatan_acknowledge,
        actor: req.user,
    });

    res.json({
        status: "success",
        message: "Surat Peringatan berhasil di-acknowledge. Terima kasih atas perhatian Anda.",
        data,
    });
});

// ===================================================================
// CRON & ANALYTICS ENDPOINTS
// ===================================================================

export const runSpCronJobs = asyncHandler(async (req: Request, res: Response) => {
    // Only allow SUPER HUMAN or admins to trigger
    if (!req.user || !req.user.roles?.some(r => r.toUpperCase().includes("SUPER HUMAN"))) {
        throw new AppError("Hanya admin yang dapat menjalankan cron jobs", 403);
    }

    const { spCronService } = await import("./sp.cron.service");
    const results = await spCronService.runAllJobs();

    res.json({
        status: "success",
        message: "Cron jobs berhasil dijalankan",
        data: results,
    });
});

export const getSpAnalytics = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AppError("User tidak terautentikasi", 401);
    }

    const stats = await spService.getAnalytics();

    res.json({
        status: "success",
        data: stats,
    });
});
