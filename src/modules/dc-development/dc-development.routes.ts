import { Router } from "express";
import multer from "multer";
import {
    advanceDcProjectStage,
    createDcArchiveProject,
    createDcProject,
    createDcDocument,
    createDcTender,
    createDcVendor,
    createDcVendorUser,
    deleteDcDocument,
    downloadDcDocument,
    getDcDocumentDetail,
    getDcProjectById,
    listDcArchiveProjects,
    listDcApprovals,
    listDcDocuments,
    listDcProjects,
    listDcVendors,
    updateDcDocument,
    viewDcDocument
} from "./dc-development.controller";

const dcDevelopmentRouter = Router();
const dcDocumentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

dcDevelopmentRouter.get("/projects", listDcProjects);
dcDevelopmentRouter.post("/projects", createDcProject);
dcDevelopmentRouter.get("/projects/:id", getDcProjectById);
dcDevelopmentRouter.post("/projects/:id/advance-stage", advanceDcProjectStage);
dcDevelopmentRouter.post("/projects/:id/tenders", createDcTender);

dcDevelopmentRouter.get("/archive-projects", listDcArchiveProjects);
dcDevelopmentRouter.post("/archive-projects", createDcArchiveProject);

dcDevelopmentRouter.get("/vendors", listDcVendors);
dcDevelopmentRouter.post("/vendors", createDcVendor);
dcDevelopmentRouter.post("/vendors/:id/users", createDcVendorUser);

dcDevelopmentRouter.get("/approvals", listDcApprovals);

dcDevelopmentRouter.get("/documents", listDcDocuments);
dcDevelopmentRouter.post("/documents", dcDocumentUpload.any(), createDcDocument);
dcDevelopmentRouter.get("/documents/:id", getDcDocumentDetail);
dcDevelopmentRouter.put("/documents/:id", dcDocumentUpload.any(), updateDcDocument);
dcDevelopmentRouter.delete("/documents/:id", deleteDcDocument);
dcDevelopmentRouter.get("/documents/:id/view", viewDcDocument);
dcDevelopmentRouter.get("/documents/:id/download", downloadDcDocument);

export { dcDevelopmentRouter };
