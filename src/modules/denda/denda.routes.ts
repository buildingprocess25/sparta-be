import { Router } from "express";
import { getDendaByTokoId } from "./denda.controller";

const dendaRouter = Router();

dendaRouter.get("/:id_toko", getDendaByTokoId);

export { dendaRouter };
