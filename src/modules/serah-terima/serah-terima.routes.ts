import { Router } from "express";
import { createPdfSerahTerima, listBerkasSerahTerima } from "./serah-terima.controller";

const serahTerimaRouter = Router();

serahTerimaRouter.post("/create_pdf_serah_terima", createPdfSerahTerima);
serahTerimaRouter.get("/berkas_serah_terima", listBerkasSerahTerima);

export { serahTerimaRouter };
