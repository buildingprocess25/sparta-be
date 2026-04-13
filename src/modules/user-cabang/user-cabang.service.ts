import { AppError } from "../../common/app-error";
import { userCabangRepository } from "./user-cabang.repository";
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

export const userCabangService = {
    async create(input: CreateUserCabangInput) {
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

    async getByKey(cabang: string, emailSat: string) {
        const data = await userCabangRepository.findByKey(cabang, emailSat);
        if (!data) {
            throw new AppError("Data user_cabang tidak ditemukan", 404);
        }

        return data;
    },

    async list(query: ListUserCabangQueryInput) {
        return userCabangRepository.findAll(query);
    },

    async updateByKey(cabang: string, emailSat: string, input: UpdateUserCabangInput) {
        try {
            const updated = await userCabangRepository.updateByKey(cabang, emailSat, input);
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

    async deleteByKey(cabang: string, emailSat: string) {
        const deleted = await userCabangRepository.deleteByKey(cabang, emailSat);
        if (!deleted) {
            throw new AppError("Data user_cabang tidak ditemukan", 404);
        }

        return deleted;
    }
};
