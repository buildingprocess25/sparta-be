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
    viewDcDocument,
    listDcTenders,
    getDcTenderById,
    inviteDcTenderParticipant,
    submitDcTenderSubmission,
    setDcTenderWinner,
    listDcProjectTimelines,
    addDcProjectTimeline,
    updateDcProjectTimeline,
    listDcProjectIssues,
    addDcProjectIssue,
    updateDcProjectIssue,
    listDcProjectBast,
    createDcProjectBast,
    updateDcProjectBast,
    listDcParticipantTerms,
    addDcTermSchedule,
    submitDcTermClaim
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
dcDevelopmentRouter.get("/projects/:id/timeline", listDcProjectTimelines);
dcDevelopmentRouter.post("/projects/:id/timeline", addDcProjectTimeline);
dcDevelopmentRouter.put("/projects/:id/timeline/:taskId", updateDcProjectTimeline);
dcDevelopmentRouter.get("/projects/:id/issues", listDcProjectIssues);
dcDevelopmentRouter.post("/projects/:id/issues", addDcProjectIssue);
dcDevelopmentRouter.put("/projects/:id/issues/:issueId", updateDcProjectIssue);
dcDevelopmentRouter.get("/projects/:id/bast", listDcProjectBast);
dcDevelopmentRouter.post("/projects/:id/bast", createDcProjectBast);
dcDevelopmentRouter.put("/projects/:id/bast/:bastId", updateDcProjectBast);

dcDevelopmentRouter.get("/tenders", listDcTenders);
dcDevelopmentRouter.get("/tenders/:id", getDcTenderById);
dcDevelopmentRouter.post("/tenders/:id/participants", inviteDcTenderParticipant);
dcDevelopmentRouter.post("/tenders/:id/submissions", submitDcTenderSubmission);
dcDevelopmentRouter.post("/tenders/:id/winner", setDcTenderWinner);

dcDevelopmentRouter.get("/tenders/participants/:participantId/terms", listDcParticipantTerms);
dcDevelopmentRouter.post("/tenders/participants/:participantId/terms", addDcTermSchedule);
dcDevelopmentRouter.post("/tenders/participants/terms/:termId/claim", submitDcTermClaim);

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
