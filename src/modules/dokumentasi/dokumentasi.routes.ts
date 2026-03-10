import { Router } from "express";
import {
    loginDokumentasi,
    spkData,
    viewPhoto,
    saveTemp,
    getTemp,
    cekStatus,
    saveToko,
    sendPdfEmail,
    validateDokumentasi,
} from "./dokumentasi.controller";

const dokumentasiRouter = Router();

dokumentasiRouter.post("/auth/login", loginDokumentasi);
dokumentasiRouter.post("/spk-data", spkData);
dokumentasiRouter.get("/view-photo/:fileId", viewPhoto);
dokumentasiRouter.post("/save-temp", saveTemp);
dokumentasiRouter.post("/get-temp", getTemp);
dokumentasiRouter.post("/cek-status", cekStatus);
dokumentasiRouter.post("/save-toko", saveToko);
dokumentasiRouter.post("/send-pdf-email", sendPdfEmail);
dokumentasiRouter.get("/validate", validateDokumentasi);

export { dokumentasiRouter };
