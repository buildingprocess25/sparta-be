import { Router } from "express";
import { createDendaAction, listDendaActionCandidates, listDendaActions } from "./denda-action.controller";
import { getDendaByTokoId } from "./denda.controller";

const dendaRouter = Router();

dendaRouter.get("/actions/candidates", listDendaActionCandidates);
dendaRouter.get("/actions", listDendaActions);
dendaRouter.post("/actions", createDendaAction);
dendaRouter.get("/:id_toko", getDendaByTokoId);

export { dendaRouter };
