import { AppError } from "../../common/app-error";
import { tokoRepository } from "./toko.repository";
import type { CreateTokoInput } from "./toko.schema";

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

    async list(search?: string) {
        return tokoRepository.findAll(search);
    }
};
