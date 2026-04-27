import { Router } from "express";
import { createPdfSerahTerima } from "./serah-terima.controller";

const serahTerimaRouter = Router();

serahTerimaRouter.post("/create_pdf_serah_terima", createPdfSerahTerima);

export { serahTerimaRouter };
