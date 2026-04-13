import { Router } from "express";
import {
    createUserCabang,
    deleteUserCabangByKey,
    getUserCabangByKey,
    listUserCabang,
    updateUserCabangByKey
} from "./user-cabang.controller";

const userCabangRouter = Router();

userCabangRouter.post("/", createUserCabang);
userCabangRouter.get("/", listUserCabang);
userCabangRouter.get("/:cabang/:email_sat", getUserCabangByKey);
userCabangRouter.put("/:cabang/:email_sat", updateUserCabangByKey);
userCabangRouter.delete("/:cabang/:email_sat", deleteUserCabangByKey);

export { userCabangRouter };
