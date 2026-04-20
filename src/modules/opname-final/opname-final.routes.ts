import { Router } from "express";
import {
    downloadOpnameFinalPdf,
    getOpnameFinalById,
    handleOpnameFinalApproval,
    lockOpnameFinal,
    listOpnameFinal
} from "./opname-final.controller";

const opnameFinalRouter = Router();

opnameFinalRouter.get("/", listOpnameFinal);
opnameFinalRouter.get("/:id", getOpnameFinalById);
opnameFinalRouter.get("/:id/pdf", downloadOpnameFinalPdf);
opnameFinalRouter.post("/:id/kunci_opname_final", lockOpnameFinal);
opnameFinalRouter.post("/:id/approval", handleOpnameFinalApproval);
opnameFinalRouter.post("/approval/:id", handleOpnameFinalApproval);

export { opnameFinalRouter };
