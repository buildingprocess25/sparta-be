import { Router } from "express";
import multer from "multer";
import {
	deleteRabItems,
	downloadRabInsuranceFile,
	downloadRabLogo,
	downloadRabPdf,
	getRabById,
	handleRabApproval,
	listRab,
	replaceRabItems,
	submitRab,
	updateRabItemsBulk,
	updateRabStatus,
} from "./rab.controller";

const rabRouter = Router();
const RAB_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const rabUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: RAB_UPLOAD_LIMIT_BYTES,
		fieldSize: RAB_UPLOAD_LIMIT_BYTES,
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
rabRouter.put("/:id/items", updateRabItemsBulk);
rabRouter.put("/:id/items/replace", replaceRabItems);
rabRouter.delete("/:id/items", deleteRabItems);
rabRouter.get("/:id/pdf", downloadRabPdf);
rabRouter.get("/:id/logo", downloadRabLogo);
rabRouter.get("/:id/file-asuransi", downloadRabInsuranceFile);
rabRouter.post("/:id/approval", handleRabApproval);
rabRouter.put("/update-status", updateRabStatus);

export { rabRouter };
