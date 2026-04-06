import { Router } from "express";
import {
    createPertambahanSpk,
    deletePertambahanSpkById,
    getPertambahanSpkById,
    handlePertambahanSpkApproval,
    listPertambahanSpk,
    updatePertambahanSpkById
} from "./pertambahan-spk.controller";

const pertambahanSpkRouter = Router();

pertambahanSpkRouter.post("/", createPertambahanSpk);
pertambahanSpkRouter.get("/", listPertambahanSpk);
pertambahanSpkRouter.get("/:id", getPertambahanSpkById);
pertambahanSpkRouter.put("/:id", updatePertambahanSpkById);
pertambahanSpkRouter.post("/:id/approval", handlePertambahanSpkApproval);
pertambahanSpkRouter.delete("/:id", deletePertambahanSpkById);

export { pertambahanSpkRouter };
