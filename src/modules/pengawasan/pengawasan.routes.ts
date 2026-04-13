import { Router } from "express";
import {
    createBulkPengawasan,
    createPengawasan,
    deletePengawasan,
    getPengawasanById,
    listPengawasan,
    updatePengawasan
} from "./pengawasan.controller";

const pengawasanRouter = Router();

pengawasanRouter.post("/", createPengawasan);
pengawasanRouter.post("/bulk", createBulkPengawasan);
pengawasanRouter.get("/", listPengawasan);
pengawasanRouter.get("/:id", getPengawasanById);
pengawasanRouter.put("/:id", updatePengawasan);
pengawasanRouter.delete("/:id", deletePengawasan);

export { pengawasanRouter };
