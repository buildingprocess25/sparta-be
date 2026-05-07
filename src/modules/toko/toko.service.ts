import { AppError } from "../../common/app-error";
import { tokoRepository } from "./toko.repository";
import type {
    CreateTokoInput,
    ListTokoQueryInput,
    LoginUserCabangInput,
    GetTokoDetailQueryInput,
    UpdateTokoByIdBodyInput
} from "./toko.schema";

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

    async getDetail(query: GetTokoDetailQueryInput) {
        const toko = await tokoRepository.findDetail(query);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }
        return toko;
    },

    async updateById(id: number, input: UpdateTokoByIdBodyInput) {
        const toko = await tokoRepository.updateById(id, input);
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

        const registeredUsers = await tokoRepository.findUserCabangByEmailSatAll(emailSat);
        if (registeredUsers.length === 0) {
            throw new AppError("email belum terdaftar", 404);
        }

        const matchedUser = registeredUsers.find(
            (user) => user.cabang.toLowerCase() === cabang.toLowerCase()
        );
        if (!matchedUser) {
            throw new AppError("password salah", 401);
        }

        const alamatCabangRow = await tokoRepository.findAlamatCabangByCabang(matchedUser.cabang);
        const alamat_cabang = alamatCabangRow?.alamat ?? null;
        const jabatanList = Array.from(new Set(registeredUsers.map((user) => user.jabatan)));
        if (jabatanList.length > 1) {
            return { ...matchedUser, jabatan: jabatanList, alamat_cabang };
        }

        return { ...matchedUser, alamat_cabang };
    }
};
