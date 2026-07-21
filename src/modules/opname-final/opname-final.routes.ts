import { Router } from "express";
import {
    downloadOpnameFinalPdf,
    getOpnameFinalById,
    handleOpnameFinalApproval,
    lockOpnameFinal,
    listOpnameFinal,
    regenerateOpnameFinalPdf
} from "./opname-final.controller";
import multer from "multer";
import {
    commitOpnameFinalMigration,
    previewOpnameFinalMigration
} from "./opname-final-migration.controller";

const opnameFinalRouter = Router();
const migrationUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 80 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 }
});

opnameFinalRouter.post("/migration/preview", migrationUpload.single("file"), previewOpnameFinalMigration);
opnameFinalRouter.post("/migration/commit", migrationUpload.single("file"), commitOpnameFinalMigration);
opnameFinalRouter.get("/", listOpnameFinal);
opnameFinalRouter.get("/:id", getOpnameFinalById);
opnameFinalRouter.get("/:id/pdf", downloadOpnameFinalPdf);
opnameFinalRouter.post("/:id/pdf/regenerate", regenerateOpnameFinalPdf);
opnameFinalRouter.post("/:id/kunci_opname_final", lockOpnameFinal);
opnameFinalRouter.post("/:id/approval", handleOpnameFinalApproval);
opnameFinalRouter.post("/approval/:id", handleOpnameFinalApproval);

export { opnameFinalRouter };
