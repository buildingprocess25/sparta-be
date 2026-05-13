import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    submitProjekPlanningSchema,
    resubmitProjekPlanningSchema,
    approvalSchema,
    ppApproval1Schema,
    upload3dSchema,
    uploadRabSchema,
    listProjekPlanningQuerySchema,
} from "./projek-planning.schema";
import { projekPlanningService } from "./projek-planning.service";

// ============================================================
// SUBMIT FPD (Coordinator) — record baru
// ============================================================

export const submitProjekPlanning = asyncHandler(async (req: Request, res: Response) => {
    const payloadStr = req.body;
    if (typeof payloadStr.ketentuan === "string") payloadStr.ketentuan = JSON.parse(payloadStr.ketentuan);
    if (typeof payloadStr.catatan_design === "string") payloadStr.catatan_design = JSON.parse(payloadStr.catatan_design);
    if (typeof payloadStr.fasilitas === "string") payloadStr.fasilitas = JSON.parse(payloadStr.fasilitas);

    const payload = submitProjekPlanningSchema.parse(payloadStr);
    const files = req.files as Express.Multer.File[] | undefined;
    const result = await projekPlanningService.submit(payload, files);

    res.status(201).json({
        status: "success",
        message: "Pengajuan FPD berhasil dibuat dan diteruskan ke B&M Manager",
        data: result,
    });
});

// ============================================================
// RESUBMIT FPD (Coordinator) — update record DRAFT yang sudah ada
// ============================================================

export const resubmitProjekPlanning = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const payloadStr = req.body;
    if (typeof payloadStr.ketentuan === "string") payloadStr.ketentuan = JSON.parse(payloadStr.ketentuan);
    if (typeof payloadStr.catatan_design === "string") payloadStr.catatan_design = JSON.parse(payloadStr.catatan_design);
    if (typeof payloadStr.fasilitas === "string") payloadStr.fasilitas = JSON.parse(payloadStr.fasilitas);

    const payload = resubmitProjekPlanningSchema.parse(payloadStr);
    const files = req.files as Express.Multer.File[] | undefined;
    const result = await projekPlanningService.resubmit(id, payload, files);

    res.json({
        status: "success",
        message: "Pengajuan FPD berhasil di-resubmit dan diteruskan kembali ke B&M Manager",
        data: result,
    });
});

// ============================================================
// LIST
// ============================================================

export const listProjekPlanning = asyncHandler(async (req: Request, res: Response) => {
    const query = listProjekPlanningQuerySchema.parse(req.query);
    const data = await projekPlanningService.list(query);

    res.json({ status: "success", data });
});

// ============================================================
// GET BY ID
// ============================================================

export const getProjekPlanningById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const data = await projekPlanningService.getById(id);
    res.json({ status: "success", data });
});

// ============================================================
// BM APPROVAL
// ============================================================

export const handleBmApproval = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const action = approvalSchema.parse(req.body);
    const result = await projekPlanningService.bmApproval(id, action);

    res.json({
        status: "success",
        message: action.tindakan === "APPROVE"
            ? "Disetujui oleh BM Manager, menunggu approval PP Specialist"
            : "Ditolak oleh BM Manager, dikembalikan ke Coordinator",
        data: result,
    });
});

// ============================================================
// PP APPROVAL STAGE 1
// ============================================================

export const handlePpApproval1 = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const action = ppApproval1Schema.parse(req.body);
    const result = await projekPlanningService.ppApproval1(id, action);

    let message = "Ditolak oleh PP Specialist, dikembalikan ke Coordinator dari awal";
    if (action.tindakan === "APPROVE") {
        message = action.butuh_desain_3d
            ? "Disetujui, PP Specialist perlu membuat desain 3D"
            : "Disetujui tanpa desain 3D, Cabang dapat mengupload RAB & Gambar Kerja";
    }

    res.json({ status: "success", message, data: result });
});

// ============================================================
// UPLOAD DESAIN 3D (PP Specialist)
// ============================================================

export const handleUpload3d = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const payload = upload3dSchema.parse(req.body);
    const result = await projekPlanningService.upload3d(id, payload, req.file);

    res.json({
        status: "success",
        message: "Desain 3D berhasil diupload, menunggu RAB dari Cabang",
        data: result,
    });
});

// ============================================================
// UPLOAD RAB & GAMBAR KERJA (Coordinator/Cabang)
// ============================================================

export const handleUploadRab = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const payload = uploadRabSchema.parse(req.body);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const result = await projekPlanningService.uploadRab(id, payload, files);

    res.json({
        status: "success",
        message: "RAB & Gambar Kerja berhasil diupload, menunggu approval PP Specialist",
        data: result,
    });
});

// ============================================================
// PP APPROVAL STAGE 2 (PP Specialist, setelah RAB)
// ============================================================

export const handlePpApproval2 = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const action = approvalSchema.parse(req.body);
    const result = await projekPlanningService.ppApproval2(id, action);

    res.json({
        status: "success",
        message: action.tindakan === "APPROVE"
            ? "Disetujui oleh PP Specialist, menunggu approval final PP Manager"
            : "Ditolak oleh PP Specialist, dikembalikan ke Cabang untuk Upload ulang RAB & Gambar Kerja",
        data: result,
    });
});

// ============================================================
// PP MANAGER APPROVAL (Tahap Final)
// ============================================================

export const handlePpManagerApproval = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const action = approvalSchema.parse(req.body);
    const result = await projekPlanningService.ppManagerApproval(id, action);

    res.json({
        status: "success",
        message: action.tindakan === "APPROVE"
            ? "Project planning selesai! FPD yang telah disetujui dikirim ke Cabang"
            : "Ditolak oleh PP Manager, dikembalikan ke Cabang untuk Upload ulang RAB & Gambar Kerja",
        data: result,
    });
});

// ============================================================
// GET LOGS (Audit Trail)
// ============================================================

export const getProjekPlanningLogs = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const logs = await projekPlanningService.getLogs(id);
    res.json({ status: "success", data: logs });
});

export const downloadPdf = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const buffer = await projekPlanningService.generatePdf(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Project_Planning_${id}.pdf`);
    res.send(buffer);
});

// ============================================================
// PROXY FILE — stream GDrive file ke client (agar semua role bisa lihat/unduh)
// GET /:id/proxy-file?field=fpd|rab_sipil|rab_me|rab|gambar_kerja|desain_3d|fpd_approved|foto_item&item_index=N&mode=view|download
// ============================================================

export const proxyFile = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ status: "error", message: "ID tidak valid" });
        return;
    }

    const field = String(req.query.field || "");
    const itemIndex = req.query.item_index ? parseInt(String(req.query.item_index), 10) : undefined;
    const mode = String(req.query.mode || "view"); // "view" atau "download"

    const result = await projekPlanningService.getOne(id);
    if (!result) {
        res.status(404).json({ status: "error", message: "Projek tidak ditemukan" });
        return;
    }

    const projek = result;

    // Pilih URL berdasarkan field
    let fileUrl: string | null | undefined;
    if (field === "fpd") fileUrl = projek.link_fpd;
    else if (field === "rab_sipil") fileUrl = projek.link_gambar_rab_sipil;
    else if (field === "rab_me") fileUrl = projek.link_gambar_rab_me;
    else if (field === "rab") fileUrl = projek.link_rab;
    else if (field === "gambar_kerja") fileUrl = projek.link_gambar_kerja;
    else if (field === "desain_3d") fileUrl = projek.link_desain_3d;
    else if (field === "fpd_approved") fileUrl = projek.link_fpd_approved;
    else if (field === "gambar_kompetitor") fileUrl = projek.link_gambar_kompetitor;
    else if (field === "foto_item" && itemIndex !== undefined) {
        const fotoItem = (projek.foto_items || []).find((f: any) => f.item_index === itemIndex);
        fileUrl = fotoItem?.link_foto;
    }

    if (!fileUrl) {
        res.status(404).json({ status: "error", message: "File tidak ditemukan" });
        return;
    }

    // Ekstrak fileId dari URL GDrive
    const { extractGdriveFileId } = await import("./projek-planning.pdf");
    const fileId = extractGdriveFileId(fileUrl);

    if (!fileId) {
        // Bukan URL GDrive — redirect langsung
        res.redirect(fileUrl);
        return;
    }

    const { GoogleProvider } = await import("../../common/google");
    const drive = GoogleProvider.instance.docDrive;
    if (!drive) {
        res.status(503).json({ status: "error", message: "Layanan Drive belum siap" });
        return;
    }

    // Ambil metadata file
    let mimeType = "application/octet-stream";
    let fileName = `file_${field}_${id}`;
    try {
        const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
        if (meta.data.name) fileName = meta.data.name;
        if (meta.data.mimeType) mimeType = meta.data.mimeType;
    } catch { /* ignore, gunakan default */ }

    // Download buffer
    const buffer = await GoogleProvider.instance.getFileBufferById(drive, fileId);
    if (!buffer) {
        res.status(502).json({ status: "error", message: "Gagal mengambil file dari Drive" });
        return;
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
        "Content-Disposition",
        mode === "download"
            ? `attachment; filename="${encodeURIComponent(fileName)}"`
            : `inline; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
});

