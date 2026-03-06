import { Router } from "express";
import { downloadRabPdf, getRabById, handleRabApproval, listRab, submitRab } from "./rab.controller";

const rabRouter = Router();

rabRouter.post("/submit", submitRab);
rabRouter.get("/", listRab);
rabRouter.get("/:id", getRabById);
rabRouter.get("/:id/pdf", downloadRabPdf);
rabRouter.post("/:id/approval", handleRabApproval);

export { rabRouter };
