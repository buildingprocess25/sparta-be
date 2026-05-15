import { Router } from "express";
import multer from "multer";
import {
    submitProjekPlanning,
    resubmitProjekPlanning,
    listProjekPlanning,
    getProjekPlanningById,
    handleBmApproval,
    handlePpApproval1,
    handleUpload3d,
    handleUploadRab,
    handlePpManagerApproval,
    handlePpApproval2,
    getProjekPlanningLogs,
    downloadPdf,
    proxyFile,
} from "./projek-planning.controller";

const fpdUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const projekPlanningRouter = Router();

// ── Coordinator ──────────────────────────────────────────────
projekPlanningRouter.post("/submit", fpdUpload.any(), submitProjekPlanning);
projekPlanningRouter.post("/:id/resubmit", fpdUpload.any(), resubmitProjekPlanning);
projekPlanningRouter.post(
    "/:id/upload-rab",
    fpdUpload.fields([
        { name: "file_rab_sipil", maxCount: 1 },
        { name: "file_rab_me", maxCount: 1 },
        { name: "file_gambar_kerja", maxCount: 1 },
        // Backward compatibility for older clients that still send one generic RAB file.
        { name: "file_rab", maxCount: 1 },
    ]),
    handleUploadRab
);

// ── Query ─────────────────────────────────────────────────────
projekPlanningRouter.get("/", listProjekPlanning);
projekPlanningRouter.get("/:id", getProjekPlanningById);
projekPlanningRouter.get("/:id/logs", getProjekPlanningLogs);
projekPlanningRouter.get("/:id/pdf", downloadPdf);
projekPlanningRouter.get("/:id/proxy-file", proxyFile);

// ── BM Manager ───────────────────────────────────────────────
projekPlanningRouter.post("/:id/bm-approval", handleBmApproval);

// ── PP Specialist ─────────────────────────────────────────────
projekPlanningRouter.post("/:id/pp-approval-1", handlePpApproval1);
projekPlanningRouter.post("/:id/upload-3d", fpdUpload.single("file_desain_3d"), handleUpload3d);
projekPlanningRouter.post("/:id/pp-approval-2", handlePpApproval2);

// ── PP Manager ────────────────────────────────────────────────
projekPlanningRouter.post("/:id/pp-manager-approval", handlePpManagerApproval);

export { projekPlanningRouter };
