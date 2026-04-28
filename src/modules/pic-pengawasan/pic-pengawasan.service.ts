import { AppError } from "../../common/app-error";
import { picPengawasanRepository } from "./pic-pengawasan.repository";
import type { CreatePicPengawasanInput, ListPicPengawasanQueryInput } from "./pic-pengawasan.schema";

type PgError = {
    code?: string;
    constraint?: string;
};

const toPgError = (error: unknown): PgError => {
    if (typeof error === "object" && error !== null) {
        return error as PgError;
    }

    return {};
};

export const picPengawasanService = {
    async create(input: CreatePicPengawasanInput) {
        try {
            return await picPengawasanRepository.create(input);
        } catch (error: unknown) {
            const pgError = toPgError(error);

            if (pgError.code === "23505") {
                throw new AppError("Relasi 1:1 sudah terpakai. Pastikan nomor_ulok, id_rab, dan id_spk belum pernah dipakai.", 409);
            }

            if (pgError.code === "23503") {
                if (pgError.constraint === "fk_pic_pengawasan_toko_id") {
                    throw new AppError("id_toko tidak ditemukan di tabel toko", 404);
                }

                if (pgError.constraint === "fk_pic_pengawasan_toko_ulok") {
                    throw new AppError("nomor_ulok tidak ditemukan di tabel toko", 404);
                }

                if (pgError.constraint === "fk_pic_pengawasan_rab") {
                    throw new AppError("id_rab tidak ditemukan di tabel rab", 404);
                }

                if (pgError.constraint === "fk_pic_pengawasan_spk") {
                    throw new AppError("id_spk tidak ditemukan di tabel pengajuan_spk", 404);
                }

                throw new AppError("Relasi data tidak valid", 400);
            }

            throw error;
        }
    },

    async getById(id: string) {
        const data = await picPengawasanRepository.findById(id);
        if (!data) {
            throw new AppError("Data pic_pengawasan tidak ditemukan", 404);
        }

        return data;
    },

    async list(query: ListPicPengawasanQueryInput) {
        return picPengawasanRepository.findAll(query);
    }
};