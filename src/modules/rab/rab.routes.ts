import { Router } from "express";
import multer from "multer";
import {
	downloadRabInsuranceFile,
	downloadRabLogo,
	downloadRabPdf,
	getRabById,
	handleRabApproval,
	listRab,
	submitRab,
	updateRabStatus,
} from "./rab.controller";

const rabRouter = Router();
const rabUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024
	}
});

rabRouter.post(
	"/submit",
	rabUpload.fields([
		{ name: "file_asuransi", maxCount: 1 },
		{ name: "rev_file_asuransi", maxCount: 1 },
		{ name: "rev_logo", maxCount: 1 },
	]),
	submitRab
);
rabRouter.get("/", listRab);
rabRouter.get("/:id", getRabById);
rabRouter.get("/:id/pdf", downloadRabPdf);
rabRouter.get("/:id/logo", downloadRabLogo);
rabRouter.get("/:id/file-asuransi", downloadRabInsuranceFile);
rabRouter.post("/:id/approval", handleRabApproval);
rabRouter.put("/update-status", updateRabStatus);

export { rabRouter };
