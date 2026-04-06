import { Router } from "express";
import multer from "multer";
import { downloadRabPdf, getRabById, handleRabApproval, listRab, submitRab } from "./rab.controller";

const rabRouter = Router();
const rabUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024
	}
});

rabRouter.post("/submit", rabUpload.single("file_asuransi"), submitRab);
rabRouter.get("/", listRab);
rabRouter.get("/:id", getRabById);
rabRouter.get("/:id/pdf", downloadRabPdf);
rabRouter.post("/:id/approval", handleRabApproval);

export { rabRouter };
