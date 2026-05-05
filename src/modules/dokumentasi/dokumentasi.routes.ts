import { Router } from "express";
import multer from "multer";
import {
    addDokumentasiBangunanItems,
    createDokumentasiBangunan,
    createDokumentasiBangunanPdf,
    deleteDokumentasiBangunan,
    deleteDokumentasiBangunanItem,
    getDokumentasiBangunanDetail,
    listDokumentasiBangunan,
    updateDokumentasiBangunan
} from "./dokumentasi.controller";

const dokumentasiRouter = Router();

const dokumentasiUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

dokumentasiRouter.post(
    "/bangunan",
    dokumentasiUpload.array("foto", 200),
    createDokumentasiBangunan
);

dokumentasiRouter.get("/bangunan", listDokumentasiBangunan);

dokumentasiRouter.get("/bangunan/:id", getDokumentasiBangunanDetail);

dokumentasiRouter.put(
    "/bangunan/:id",
    dokumentasiUpload.array("foto", 200),
    updateDokumentasiBangunan
);

dokumentasiRouter.delete("/bangunan/:id", deleteDokumentasiBangunan);

dokumentasiRouter.post(
    "/bangunan/:id/items",
    dokumentasiUpload.array("foto", 200),
    addDokumentasiBangunanItems
);

dokumentasiRouter.delete(
    "/bangunan/items/:itemId",
    deleteDokumentasiBangunanItem
);

dokumentasiRouter.post(
    "/bangunan/:id/pdf",
    createDokumentasiBangunanPdf
);

export { dokumentasiRouter };
