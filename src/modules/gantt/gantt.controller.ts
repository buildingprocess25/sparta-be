import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import {
    addDayItemsSchema,
    createGanttNoteSchema,
    ganttDetailQuerySchema,
    ganttDetailByTokoSchema,
    ganttListQuerySchema,
    ganttInterventionSchema,
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
    const query = ganttDetailQuerySchema.parse(req.query);
    const idToko = query.id_toko ? Number(query.id_toko) : undefined;
    const data = await ganttService.getById(req.params.id, idToko);

    res.json({ status: "success", data });
});

export const listGanttNotes = asyncHandler(async (req: Request, res: Response) => {
    const data = await ganttService.listNotes(req.params.id);

    res.json({ status: "success", data });
});

export const createGanttNote = asyncHandler(async (req: Request, res: Response) => {
    const payload = createGanttNoteSchema.parse(req.body);
    const data = await ganttService.createNote(req.params.id, payload);

    res.status(201).json({
        status: "success",
        message: "Catatan pengawasan berhasil dikirim",
        data
    });
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

export const interveneGantt = asyncHandler(async (req: Request, res: Response) => {
    const payload = ganttInterventionSchema.parse(req.body);
    const result = await ganttService.intervene(req.params.id, payload);

    res.json({
        status: "success",
        message: "Intervensi Gantt Chart berhasil diproses",
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
        instruksi_lapangan_items: data.instruksi_lapangan_items,
        toko: data.toko
    });
});

export const previewGanttMigration = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError("File tidak ditemukan", 400);
    }
    
    const result = await ganttService.previewMigrationExcel(req.file.buffer);

    res.status(200).json({
        status: "success",
        message: "Preview berhasil dibuat",
        data: result
    });
});

export const commitGanttMigration = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError("File tidak ditemukan", 400);
    }
    
    const emailPembuat = req.body.email_pembuat || "system@import.com";
    const limit = req.body.limit ? Number(req.body.limit) : undefined;
    
    const result = await ganttService.commitMigrationExcel(req.file.buffer, emailPembuat, limit);

    res.status(201).json({
        status: "success",
        message: "Migrasi berhasil",
        data: result
    });
});
