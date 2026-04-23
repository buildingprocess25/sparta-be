import { Router } from "express";
import multer from "multer";
import {
    createBulkOpname,
    createOpname,
    downloadOpnameFoto,
    deleteOpname,
    getOpnameById,
    listOpname,
    updateOpname
} from "./opname.controller";

const opnameRouter = Router();
const opnameUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

opnameRouter.post(
    "/",
    opnameUpload.fields([
        { name: "file_foto_opname", maxCount: 1 }
    ]),
    createOpname
);
opnameRouter.post(
    "/bulk",
    opnameUpload.fields([
        { name: "file_foto_opname", maxCount: 50 }
    ]),
    createBulkOpname
);
opnameRouter.get("/", listOpname);
opnameRouter.get("/:id", getOpnameById);
opnameRouter.get("/:id/foto", downloadOpnameFoto);
opnameRouter.put(
    "/:id",
    opnameUpload.fields([
        { name: "rev_file_foto_opname", maxCount: 1 }
    ]),
    updateOpname
);
opnameRouter.delete("/:id", deleteOpname);

export { opnameRouter };
