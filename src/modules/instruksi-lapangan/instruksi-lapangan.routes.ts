import { Router } from "express";
import multer from "multer";
import {
    submitInstruksiLapangan,
    listInstruksiLapangan,
    getInstruksiLapanganById,
    downloadInstruksiLapanganPdf,
    downloadInstruksiLapanganLampiran,
    handleInstruksiLapanganApproval
} from "./instruksi-lapangan.controller";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const router = Router();

router.post(
    "/submit",
    upload.fields([
        { name: "lampiran", maxCount: 1 }
    ]),
    submitInstruksiLapangan
);

router.get("/list", listInstruksiLapangan);
router.get("/:id", getInstruksiLapanganById);
router.get("/:id/pdf", downloadInstruksiLapanganPdf);
router.get("/:id/lampiran", downloadInstruksiLapanganLampiran);
router.post("/:id/approval", handleInstruksiLapanganApproval);

export { router as instruksiLapanganRouter };
