import { Router } from "express";
import {
    approveDendaAction,
    createDendaAction,
    listDendaActionCandidates,
    listDendaActions,
    rejectDendaAction,
} from "./denda-action.controller";
import { getDendaByTokoId } from "./denda.controller";

const dendaRouter = Router();

dendaRouter.get("/actions/candidates", listDendaActionCandidates);
dendaRouter.get("/actions", listDendaActions);
dendaRouter.post("/actions", createDendaAction);
dendaRouter.post("/actions/:id/approve", approveDendaAction);
dendaRouter.post("/actions/:id/reject", rejectDendaAction);
dendaRouter.get("/:id_toko", getDendaByTokoId);

export { dendaRouter };
