import { AppError } from "../../common/app-error";
import { DC_USER_ROLE_OPTIONS, userCabangRepository } from "./user-cabang.repository";
import type { CreateUserCabangInput, ListUserCabangQueryInput, UpdateUserCabangInput } from "./user-cabang.schema";

type PgError = {
    code?: string;
};

const toPgError = (error: unknown): PgError => {
    if (typeof error === "object" && error !== null) {
        return error as PgError;
    }

    return {};
};

const isDcRole = (role?: string | null) =>
    DC_USER_ROLE_OPTIONS.includes(String(role ?? "").trim().toUpperCase() as typeof DC_USER_ROLE_OPTIONS[number]);

const assertDcUserPayload = (input: CreateUserCabangInput | UpdateUserCabangInput) => {
    if (input.workspace !== "dc") return;
    if (input.jabatan && !isDcRole(input.jabatan)) {
        throw new AppError("Role tidak termasuk role DC Development", 422);
    }
    if (
        String(input.jabatan ?? "").trim().toUpperCase() === "DC DOCUMENT ADMIN"
        && input.cabang
        && input.cabang.trim().toUpperCase() !== "HEAD OFFICE"
    ) {
        throw new AppError("DC Document Admin wajib menggunakan cabang HEAD OFFICE", 422);
    }
};

export const userCabangService = {
    async create(input: CreateUserCabangInput) {
        assertDcUserPayload(input);
        try {
            return await userCabangRepository.create(input);
        } catch (error: unknown) {
            const pgError = toPgError(error);
            if (pgError.code === "23505") {
                throw new AppError("Data user_cabang dengan email_sat dan cabang tersebut sudah ada", 409);
            }

            throw error;
        }
    },

    async getById(id: number) {
        const data = await userCabangRepository.findById(id);
        if (!data) {
            throw new AppError("Data user_cabang tidak ditemukan", 404);
        }

        return data;
    },

    async list(query: ListUserCabangQueryInput) {
        return userCabangRepository.findAll(query);
    },

    async updateById(id: number, input: UpdateUserCabangInput) {
        assertDcUserPayload(input);
        try {
            const updated = await userCabangRepository.updateById(id, input);
            if (!updated) {
                throw new AppError("Data user_cabang tidak ditemukan", 404);
            }

            return updated;
        } catch (error: unknown) {
            const pgError = toPgError(error);
            if (pgError.code === "23505") {
                throw new AppError("Data user_cabang dengan email_sat dan cabang tersebut sudah ada", 409);
            }

            throw error;
        }
    },

    async deleteById(id: number) {
        const deleted = await userCabangRepository.deleteById(id);
        if (!deleted) {
            throw new AppError("Data user_cabang tidak ditemukan", 404);
        }

        return deleted;
    }
};
