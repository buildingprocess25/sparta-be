import { Router } from "express";
import { createToko, getTokoByNomorUlok, listToko } from "./toko.controller";

const tokoRouter = Router();

tokoRouter.post("/", createToko);
tokoRouter.get("/", listToko);
tokoRouter.get("/:nomorUlok", getTokoByNomorUlok);

export { tokoRouter };
