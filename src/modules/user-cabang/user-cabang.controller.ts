import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { AppError } from "../../common/app-error";
import { getEffectiveBranchesForUser } from "../../common/branch-scope";
import {
    createUserCabangSchema,
    listUserCabangQuerySchema,
    updateUserCabangSchema,
    userCabangIdParamSchema
} from "./user-cabang.schema";
import { userCabangService } from "./user-cabang.service";

/**
 * Check if user has permission to manage user_cabang (CRUD operations)
 */
const canManageUsers = (user?: { roles: string[] }): boolean => {
    if (!user) return false;
    
    return user.roles.some((role) => {
        const normalized = role.trim().toUpperCase();
        return normalized.includes("SUPER HUMAN") || 
               normalized.includes("STORE & BRANCH CONTROLLING");
    });
};

export const createUserCabang = asyncHandler(async (req: Request, res: Response) => {
    if (!canManageUsers(req.user)) {
        throw new AppError("Anda tidak memiliki akses untuk membuat user", 403);
    }

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

export const getUserCabangById = asyncHandler(async (req: Request, res: Response) => {
    const params = userCabangIdParamSchema.parse(req.params);
    const data = await userCabangService.getById(params.id);

    res.json({ status: "success", data });
});

export const updateUserCabangById = asyncHandler(async (req: Request, res: Response) => {
    if (!canManageUsers(req.user)) {
        throw new AppError("Anda tidak memiliki akses untuk mengubah user", 403);
    }

    const params = userCabangIdParamSchema.parse(req.params);
    const payload = updateUserCabangSchema.parse(req.body);
    const data = await userCabangService.updateById(params.id, payload);

    res.json({
        status: "success",
        message: "Data user_cabang berhasil diperbarui",
        data
    });
});

export const deleteUserCabangById = asyncHandler(async (req: Request, res: Response) => {
    if (!canManageUsers(req.user)) {
        throw new AppError("Anda tidak memiliki akses untuk menghapus user", 403);
    }

    const params = userCabangIdParamSchema.parse(req.params);
    const data = await userCabangService.deleteById(params.id);

    res.json({
        status: "success",
        message: "Data user_cabang berhasil dihapus",
        data
    });
});

/**
 * GET /api/user-cabang/my-coverage
 * Returns the effective branches accessible by the current authenticated user.
 * This is the single source of truth for frontend branch filtering.
 */
export const getMyCoverage = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    
    if (!user) {
        res.status(401).json({
            status: "error",
            message: "Sesi tidak valid. Silakan login kembali."
        });
        return;
    }

    const result = await getEffectiveBranchesForUser({
        emailSat: user.email_sat,
        cabang: user.cabang,
        roles: user.roles
    });

    res.json({
        status: "success",
        data: {
            branches: result.branches,
            source: result.source,
            user: {
                email_sat: user.email_sat,
                cabang: user.cabang,
                jabatan: user.jabatan,
                roles: user.roles
            }
        }
    });
});
