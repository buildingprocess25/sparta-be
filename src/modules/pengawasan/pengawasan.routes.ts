import { Router } from "express";
import multer from "multer";
import {
    createBulkPengawasan,
    createPengawasan,
    deletePengawasan,
    getPengawasanById,
    listPengawasan,
    updateBulkPengawasan,
    updatePengawasan
} from "./pengawasan.controller";

const pengawasanRouter = Router();
const pengawasanUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

pengawasanRouter.post(
    "/",
    pengawasanUpload.fields([
        { name: "file_dokumentasi", maxCount: 1 },
        { name: "rev_file_dokumentasi", maxCount: 1 }
    ]),
    createPengawasan
);
pengawasanRouter.post(
    "/bulk",
    pengawasanUpload.fields([
        { name: "file_dokumentasi", maxCount: 50 }
    ]),
    createBulkPengawasan
);
pengawasanRouter.get("/", listPengawasan);
pengawasanRouter.get("/:id", getPengawasanById);
pengawasanRouter.put(
    "/bulk",
    pengawasanUpload.fields([
        { name: "rev_file_dokumentasi", maxCount: 50 }
    ]),
    updateBulkPengawasan
);
pengawasanRouter.put(
    "/:id",
    pengawasanUpload.fields([
        { name: "file_dokumentasi", maxCount: 1 },
        { name: "rev_file_dokumentasi", maxCount: 1 }
    ]),
    updatePengawasan
);
pengawasanRouter.delete("/:id", deletePengawasan);

export { pengawasanRouter };
