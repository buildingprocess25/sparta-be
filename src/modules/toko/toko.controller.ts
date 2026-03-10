import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { createTokoSchema, loginUserCabangSchema } from "./toko.schema";
import { tokoService } from "./toko.service";

export const createToko = asyncHandler(async (req: Request, res: Response) => {
    const payload = createTokoSchema.parse(req.body);
    const data = await tokoService.create(payload);

    res.status(201).json({ status: "success", data });
});

export const getTokoByNomorUlok = asyncHandler(async (req: Request, res: Response) => {
    const data = await tokoService.getByNomorUlok(req.params.nomorUlok);
    res.json({ status: "success", data });
});

export const listToko = asyncHandler(async (req: Request, res: Response) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await tokoService.list(search);
    res.json({ status: "success", data });
});

export const loginUserCabang = asyncHandler(async (req: Request, res: Response) => {
    const payload = loginUserCabangSchema.parse(req.body);
    const data = await tokoService.loginUserCabang(payload);
    res.json({ status: "success", data });
});
