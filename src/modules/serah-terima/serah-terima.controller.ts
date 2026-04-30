import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { createSerahTerimaPdfSchema, listBerkasSerahTerimaQuerySchema } from "./serah-terima.schema";
import { serahTerimaService } from "./serah-terima.service";

export const listBerkasSerahTerima = asyncHandler(async (req: Request, res: Response) => {
    const query = listBerkasSerahTerimaQuerySchema.parse(req.query);
    const data = await serahTerimaService.list(query.id_toko);

    res.json({
        status: "success",
        data,
    });
});

export const createPdfSerahTerima = asyncHandler(async (req: Request, res: Response) => {
    const { id_toko } = createSerahTerimaPdfSchema.parse(req.body);
    const data = await serahTerimaService.createPdfSerahTerima(id_toko);

    res.json({
        status: "success",
        message: "Berkas serah terima berhasil dibuat dan diupload",
        data,
    });
});
