import { Router } from "express";
import { createPdfSerahTerima, downloadBerkasSerahTerimaPdf, listBerkasSerahTerima } from "./serah-terima.controller";

const serahTerimaRouter = Router();

serahTerimaRouter.post("/create_pdf_serah_terima", createPdfSerahTerima);
serahTerimaRouter.get("/berkas_serah_terima", listBerkasSerahTerima);
serahTerimaRouter.get("/berkas_serah_terima/:id/pdf", downloadBerkasSerahTerimaPdf);

export { serahTerimaRouter };
