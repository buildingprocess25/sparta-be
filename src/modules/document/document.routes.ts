import { Router } from "express";
import multer from "multer";
import {
    createPenyimpananDokumen,
    deletePenyimpananDokumen,
    getPenyimpananDokumenDetail,
    listPenyimpananDokumen,
    updatePenyimpananDokumen
} from "./document.controller";

const documentRouter = Router();

const dokumenUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

documentRouter.post(
    "/penyimpanan-dokumen",
    dokumenUpload.any(),
    createPenyimpananDokumen
);

documentRouter.get("/penyimpanan-dokumen", listPenyimpananDokumen);

documentRouter.get(
    "/penyimpanan-dokumen/:id",
    getPenyimpananDokumenDetail
);

documentRouter.put(
    "/penyimpanan-dokumen/:id",
    dokumenUpload.any(),
    updatePenyimpananDokumen
);

documentRouter.delete(
    "/penyimpanan-dokumen/:id",
    deletePenyimpananDokumen
);

export { documentRouter };
