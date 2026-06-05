import { Router } from "express";
import {
    addDayItems,
    createGanttNote,
    deleteGantt,
    getDetailByToko,
    getGanttById,
    interveneGantt,
    listGanttNotes,
    listGantt,
    lockGantt,
    managePengawasan,
    submitGantt,
    updateGantt,
    updateKecepatan,
    updateKeterlambatan
} from "./gantt.controller";

const ganttRouter = Router();

ganttRouter.post("/submit", submitGantt);
ganttRouter.get("/", listGantt);
ganttRouter.get("/detail/:id_toko", getDetailByToko);
ganttRouter.get("/:id/notes", listGanttNotes);
ganttRouter.post("/:id/notes", createGanttNote);
ganttRouter.get("/:id", getGanttById);
ganttRouter.put("/:id", updateGantt);
ganttRouter.post("/:id/lock", lockGantt);
ganttRouter.post("/:id/intervention", interveneGantt);
ganttRouter.delete("/:id", deleteGantt);
ganttRouter.post("/:id/day", addDayItems);
ganttRouter.post("/:id/day/keterlambatan", updateKeterlambatan);
ganttRouter.post("/:id/day/kecepatan", updateKecepatan);
ganttRouter.post("/:id/pengawasan", managePengawasan);

export { ganttRouter };
