import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    addDayItemsSchema,
    ganttDetailByTokoSchema,
    ganttListQuerySchema,
    lockGanttSchema,
    managePengawasanSchema,
    submitGanttSchema,
    updateGanttSchema,
    updateKecepatanSchema,
    updateKeterlambatanSchema
} from "./gantt.schema";
import { ganttService } from "./gantt.service";

export const submitGantt = asyncHandler(async (req: Request, res: Response) => {
    const payload = submitGanttSchema.parse(req.body);
    const data = await ganttService.submit(payload);

    res.status(201).json({
        status: "success",
        message: "Gantt Chart berhasil disimpan",
        data
    });
});

export const listGantt = asyncHandler(async (req: Request, res: Response) => {
    const query = ganttListQuerySchema.parse(req.query);
    const data = await ganttService.list(query);

    res.json({ status: "success", data });
});

export const getGanttById = asyncHandler(async (req: Request, res: Response) => {
    const data = await ganttService.getById(req.params.id);

    res.json({ status: "success", data });
});

export const updateGantt = asyncHandler(async (req: Request, res: Response) => {
    const payload = updateGanttSchema.parse(req.body);
    const data = await ganttService.update(req.params.id, payload);

    res.json({
        status: "success",
        message: "Gantt Chart berhasil diperbarui",
        data
    });
});

export const lockGantt = asyncHandler(async (req: Request, res: Response) => {
    const { email } = lockGanttSchema.parse(req.body);
    const result = await ganttService.lock(req.params.id, email);

    res.json({
        status: "success",
        message: "Gantt Chart berhasil dikunci",
        data: result
    });
});

export const deleteGantt = asyncHandler(async (req: Request, res: Response) => {
    const result = await ganttService.remove(req.params.id);

    res.json({
        status: "success",
        message: "Gantt Chart berhasil dihapus",
        data: result
    });
});

export const addDayItems = asyncHandler(async (req: Request, res: Response) => {
    const payload = addDayItemsSchema.parse(req.body);
    const result = await ganttService.addDayItems(req.params.id, payload);

    res.status(201).json({
        status: "success",
        message: `${result.inserted} day item(s) berhasil ditambahkan`,
        data: result
    });
});

export const updateKeterlambatan = asyncHandler(async (req: Request, res: Response) => {
    const payload = updateKeterlambatanSchema.parse(req.body);
    const result = await ganttService.updateKeterlambatan(req.params.id, payload);

    res.json({
        status: "success",
        message: "Keterlambatan berhasil diperbarui",
        data: result
    });
});

export const updateKecepatan = asyncHandler(async (req: Request, res: Response) => {
    const payload = updateKecepatanSchema.parse(req.body);
    const result = await ganttService.updateKecepatan(req.params.id, payload);

    res.json({
        status: "success",
        message: "Kecepatan berhasil diperbarui",
        data: result
    });
});

export const managePengawasan = asyncHandler(async (req: Request, res: Response) => {
    const payload = managePengawasanSchema.parse(req.body);
    const result = await ganttService.managePengawasan(req.params.id, payload);

    const statusCode = result.action === "added" ? 201 : 200;
    const message = result.action === "added"
        ? "Pengawasan berhasil ditambahkan"
        : "Pengawasan berhasil dihapus";

    res.status(statusCode).json({
        status: "success",
        message,
        data: result
    });
});

export const getDetailByToko = asyncHandler(async (req: Request, res: Response) => {
    const { id_toko } = ganttDetailByTokoSchema.parse(req.params);
    const data = await ganttService.getDetailByTokoId(Number(id_toko));

    res.json({
        status: "success",
        rab: data.rab,
        filtered_categories: data.filtered_categories,
        gantt_data: data.gantt,
        day_gantt_data: data.day_items,
        dependency_data: data.dependencies,
        pengawasan_data: data.pengawasan,
        kategori_pekerjaan: data.kategori_pekerjaan,
        toko: data.toko
    });
});
