import { AppError } from "../../common/app-error";
import { tokoRepository } from "./toko.repository";
import type { CreateTokoInput, ListTokoQueryInput, LoginUserCabangInput } from "./toko.schema";

export const tokoService = {
    async create(input: CreateTokoInput) {
        return tokoRepository.create(input);
    },

    async getByNomorUlok(nomorUlok: string) {
        const toko = await tokoRepository.findByNomorUlok(nomorUlok);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }

        return toko;
    },

    async list(query: ListTokoQueryInput) {
        return tokoRepository.findAll(query);
    },

    async loginUserCabang(input: LoginUserCabangInput) {
        const emailSat = input.email_sat.trim();
        const cabang = input.cabang.trim();

        const registeredUser = await tokoRepository.findUserCabangByEmailSat(emailSat);
        if (!registeredUser) {
            throw new AppError("email belum terdaftar", 404);
        }

        const matchedUser = await tokoRepository.findUserCabangByEmailSatAndCabang(emailSat, cabang);
        if (!matchedUser) {
            throw new AppError("password salah", 401);
        }

        return matchedUser;
    }
};
