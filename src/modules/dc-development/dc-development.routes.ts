import { Router } from "express";
import {
    advanceDcProjectStage,
    createDcProject,
    createDcTender,
    createDcVendor,
    createDcVendorUser,
    downloadDcDocument,
    getDcProjectById,
    listDcApprovals,
    listDcDocuments,
    listDcProjects,
    listDcVendors,
    viewDcDocument
} from "./dc-development.controller";

const dcDevelopmentRouter = Router();

dcDevelopmentRouter.get("/projects", listDcProjects);
dcDevelopmentRouter.post("/projects", createDcProject);
dcDevelopmentRouter.get("/projects/:id", getDcProjectById);
dcDevelopmentRouter.post("/projects/:id/advance-stage", advanceDcProjectStage);
dcDevelopmentRouter.post("/projects/:id/tenders", createDcTender);

dcDevelopmentRouter.get("/vendors", listDcVendors);
dcDevelopmentRouter.post("/vendors", createDcVendor);
dcDevelopmentRouter.post("/vendors/:id/users", createDcVendorUser);

dcDevelopmentRouter.get("/approvals", listDcApprovals);

dcDevelopmentRouter.get("/documents", listDcDocuments);
dcDevelopmentRouter.get("/documents/:id/view", viewDcDocument);
dcDevelopmentRouter.get("/documents/:id/download", downloadDcDocument);

export { dcDevelopmentRouter };
