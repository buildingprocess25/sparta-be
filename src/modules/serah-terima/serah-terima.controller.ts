import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { correctSerahTerimaDateSchema, createSerahTerimaPdfSchema, createUnifiedSerahTerimaPdfSchema, listBerkasSerahTerimaQuerySchema } from "./serah-terima.schema";
import { serahTerimaService } from "./serah-terima.service";

export const listBerkasSerahTerima = asyncHandler(async (req: Request, res: Response) => {
    const query = listBerkasSerahTerimaQuerySchema.parse(req.query);
    const data = await serahTerimaService.list({ id_toko: query.id_toko, nomor_ulok: query.nomor_ulok });

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

export const createUnifiedPdfSerahTerima = asyncHandler(async (req: Request, res: Response) => {
    const { nomor_ulok } = createUnifiedSerahTerimaPdfSchema.parse(req.body);
    const data = await serahTerimaService.createPdfSerahTerimaUnified(nomor_ulok);

    res.json({
        status: "success",
        message: "Berkas serah terima gabungan berhasil dibuat dan diupload",
        data,
    });
});

export const correctSerahTerimaDate = asyncHandler(async (req: Request, res: Response) => {
    const payload = correctSerahTerimaDateSchema.parse(req.body);
    const data = await serahTerimaService.correctDate({
        ...payload,
        actor: req.user,
    });

    res.json({
        status: "success",
        message: "Tanggal Serah Terima berhasil diperbarui. Denda sudah disinkronkan dan dokumen terkait dijadwalkan untuk dibuat ulang.",
        data,
    });
});

export const downloadBerkasSerahTerimaPdf = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { buffer, filename } = await serahTerimaService.downloadPdfByBerkasId(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
});
