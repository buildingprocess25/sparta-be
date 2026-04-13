import { AppError } from "../../common/app-error";
import { pengawasanRepository, type PengawasanRow } from "./pengawasan.repository";
import type {
    CreatePengawasanInput,
    ListPengawasanQueryInput,
    UpdatePengawasanInput
} from "./pengawasan.schema";

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

const mapPgError = (error: unknown): never => {
    const pgError = toPgError(error);

    if (pgError.code === "23503" && pgError.constraint === "fk_pengawasan_gantt") {
        throw new AppError("id_gantt tidak ditemukan di tabel gantt_chart", 404);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_pengawasan_status") {
        throw new AppError("status harus bernilai active atau terkunci", 400);
    }

    throw error;
};

export const pengawasanService = {
    async create(input: CreatePengawasanInput): Promise<PengawasanRow> {
        try {
            return await pengawasanRepository.create(input);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async createBulk(items: CreatePengawasanInput[]): Promise<PengawasanRow[]> {
        try {
            return await pengawasanRepository.createBulk(items);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async list(query: ListPengawasanQueryInput) {
        return pengawasanRepository.findAll(query);
    },

    async getById(id: string) {
        const data = await pengawasanRepository.findById(id);
        if (!data) {
            throw new AppError("Data pengawasan tidak ditemukan", 404);
        }

        return data;
    },

    async update(id: string, input: UpdatePengawasanInput): Promise<PengawasanRow> {
        try {
            const data = await pengawasanRepository.updateById(id, input);
            if (!data) {
                throw new AppError("Data pengawasan tidak ditemukan", 404);
            }

            return data;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            return mapPgError(error);
        }
    },

    async remove(id: string) {
        const deleted = await pengawasanRepository.deleteById(id);
        if (!deleted) {
            throw new AppError("Data pengawasan tidak ditemukan", 404);
        }

        return { id: Number(id), deleted: true };
    }
};
