import { Router } from "express";
import { downloadSpkPdf, getSpkById, handleSpkApproval, listSpk, submitSpk } from "./spk.controller";

const spkRouter = Router();

spkRouter.post("/submit", submitSpk);
spkRouter.get("/", listSpk);
spkRouter.get("/:id", getSpkById);
spkRouter.get("/:id/pdf", downloadSpkPdf);
spkRouter.post("/:id/approval", handleSpkApproval);

export { spkRouter };
