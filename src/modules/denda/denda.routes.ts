import { Router } from "express";
import multer from "multer";
import {
    approveDendaAction,
    createDendaAction,
    listDendaActionKontraktor,
    listDendaActionCandidates,
    listDendaActions,
    rejectDendaAction,
} from "./denda-action.controller";
import { getDendaByTokoId } from "./denda.controller";

const dendaRouter = Router();
const dendaActionUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

dendaRouter.get("/actions/kontraktor", listDendaActionKontraktor);
dendaRouter.get("/actions/candidates", listDendaActionCandidates);
dendaRouter.get("/actions", listDendaActions);
dendaRouter.post("/actions", dendaActionUpload.single("lampiran"), createDendaAction);
dendaRouter.post("/actions/:id/approve", approveDendaAction);
dendaRouter.post("/actions/:id/reject", rejectDendaAction);
dendaRouter.get("/:id_toko", getDendaByTokoId);

export { dendaRouter };
