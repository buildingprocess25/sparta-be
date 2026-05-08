import { Router } from "express";
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
} from "./projek-planning.controller";

const projekPlanningRouter = Router();

// ── Coordinator ──────────────────────────────────────────────
projekPlanningRouter.post("/submit", submitProjekPlanning);
projekPlanningRouter.post("/:id/resubmit", resubmitProjekPlanning);
projekPlanningRouter.post("/:id/upload-rab", handleUploadRab);

// ── Query ─────────────────────────────────────────────────────
projekPlanningRouter.get("/", listProjekPlanning);
projekPlanningRouter.get("/:id", getProjekPlanningById);
projekPlanningRouter.get("/:id/logs", getProjekPlanningLogs);

// ── BM Manager ───────────────────────────────────────────────
projekPlanningRouter.post("/:id/bm-approval", handleBmApproval);

// ── PP Specialist ─────────────────────────────────────────────
projekPlanningRouter.post("/:id/pp-approval-1", handlePpApproval1);
projekPlanningRouter.post("/:id/upload-3d", handleUpload3d);
projekPlanningRouter.post("/:id/pp-approval-2", handlePpApproval2);

// ── PP Manager ────────────────────────────────────────────────
projekPlanningRouter.post("/:id/pp-manager-approval", handlePpManagerApproval);

export { projekPlanningRouter };
