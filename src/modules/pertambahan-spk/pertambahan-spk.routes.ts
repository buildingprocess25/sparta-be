import { Router } from "express";
import multer from "multer";
import {
    createPertambahanSpk,
    downloadPertambahanSpkLampiranPendukung,
    downloadPertambahanSpkPdf,
    deletePertambahanSpkById,
    getPertambahanSpkById,
    handlePertambahanSpkApproval,
    listPertambahanSpk,
    updatePertambahanSpkById
} from "./pertambahan-spk.controller";

const pertambahanSpkRouter = Router();
const pertambahanSpkUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

pertambahanSpkRouter.post("/", pertambahanSpkUpload.single("file_lampiran_pendukung"), createPertambahanSpk);
pertambahanSpkRouter.get("/", listPertambahanSpk);
pertambahanSpkRouter.get("/:id", getPertambahanSpkById);
pertambahanSpkRouter.get("/:id/pdf", downloadPertambahanSpkPdf);
pertambahanSpkRouter.get("/:id/lampiran-pendukung", downloadPertambahanSpkLampiranPendukung);
pertambahanSpkRouter.put("/:id", pertambahanSpkUpload.single("file_lampiran_pendukung"), updatePertambahanSpkById);
pertambahanSpkRouter.post("/:id/approval", handlePertambahanSpkApproval);
pertambahanSpkRouter.delete("/:id", deletePertambahanSpkById);

export { pertambahanSpkRouter };
