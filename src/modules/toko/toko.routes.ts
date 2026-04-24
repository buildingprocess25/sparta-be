import { Router } from "express";
import { createToko, getTokoByNomorUlok, getTokoDetail, listToko } from "./toko.controller";

const tokoRouter = Router();

tokoRouter.post("/", createToko);
tokoRouter.get("/", listToko);
tokoRouter.get("/detail", getTokoDetail);
tokoRouter.get("/:nomorUlok", getTokoByNomorUlok);

export { tokoRouter };
