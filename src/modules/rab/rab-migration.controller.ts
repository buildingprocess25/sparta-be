import type { Request, Response } from "express";
import { AppError } from "../../common/app-error";
import { asyncHandler } from "../../common/async-handler";
import { rabMigrationCommitSchema, rabMigrationPreviewSchema } from "./rab-migration.schema";
import { rabMigrationService } from "./rab-migration.service";

export const previewRabMigration = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError("File Excel tidak ditemukan", 400);
    }

    const payload = rabMigrationPreviewSchema.parse(req.body);
    const data = await rabMigrationService.preview(req.file.buffer, payload.actor_role);

    res.json({
        status: "success",
        message: "Preview migrasi RAB berhasil dibuat",
        data
    });
});

export const commitRabMigration = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError("File Excel tidak ditemukan", 400);
    }

    const payload = rabMigrationCommitSchema.parse(req.body);
    const data = await rabMigrationService.commit(req.file.buffer, payload);

    res.status(201).json({
        status: "success",
        message: "Migrasi RAB berhasil diproses",
        data
    });
});
