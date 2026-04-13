import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    createUserCabangSchema,
    listUserCabangQuerySchema,
    updateUserCabangSchema,
    userCabangKeyParamSchema
} from "./user-cabang.schema";
import { userCabangService } from "./user-cabang.service";

export const createUserCabang = asyncHandler(async (req: Request, res: Response) => {
    const payload = createUserCabangSchema.parse(req.body);
    const data = await userCabangService.create(payload);

    res.status(201).json({
        status: "success",
        message: "Data user_cabang berhasil disimpan",
        data
    });
});

export const listUserCabang = asyncHandler(async (req: Request, res: Response) => {
    const query = listUserCabangQuerySchema.parse(req.query);
    const data = await userCabangService.list(query);

    res.json({ status: "success", data });
});

export const getUserCabangByKey = asyncHandler(async (req: Request, res: Response) => {
    const params = userCabangKeyParamSchema.parse(req.params);
    const data = await userCabangService.getByKey(params.cabang, params.email_sat);

    res.json({ status: "success", data });
});

export const updateUserCabangByKey = asyncHandler(async (req: Request, res: Response) => {
    const params = userCabangKeyParamSchema.parse(req.params);
    const payload = updateUserCabangSchema.parse(req.body);
    const data = await userCabangService.updateByKey(params.cabang, params.email_sat, payload);

    res.json({
        status: "success",
        message: "Data user_cabang berhasil diperbarui",
        data
    });
});

export const deleteUserCabangByKey = asyncHandler(async (req: Request, res: Response) => {
    const params = userCabangKeyParamSchema.parse(req.params);
    const data = await userCabangService.deleteByKey(params.cabang, params.email_sat);

    res.json({
        status: "success",
        message: "Data user_cabang berhasil dihapus",
        data
    });
});
