import { AppError } from "../../common/app-error";
import { authOtpService } from "../auth/auth-otp.service";
import { authSessionService } from "../auth/auth-session.service";
import { tokoRepository } from "./toko.repository";
import type {
    CreateTokoInput,
    ListTokoQueryInput,
    LoginUserCabangInput,
    VerifyOtpInput,
    GetTokoDetailQueryInput,
    UpdateTokoByIdBodyInput
} from "./toko.schema";

const isHeadOfficeCabang = (cabang: string) => cabang.trim().toLowerCase() === "head office";
const OTP_CHALLENGE_JABATAN = "BUILDING & MAINTENANCE SUPER HUMAN";
const isOtpChallengeJabatan = (jabatan?: string | null) =>
    (jabatan ?? "").trim().toLowerCase() === OTP_CHALLENGE_JABATAN.toLowerCase();

const buildLoginResponse = async (input: {
    matchedUser: { cabang: string; nama_lengkap: string; jabatan: string; email_sat: string; nama_pt: string };
    registeredUsers: Array<{ cabang: string; nama_lengkap: string; jabatan: string; email_sat: string; nama_pt: string }>;
}) => {
    const alamatCabangRow = await tokoRepository.findAlamatCabangByCabang(input.matchedUser.cabang);
    const alamat_cabang = alamatCabangRow?.alamat ?? null;
    const jabatanList = Array.from(new Set(input.registeredUsers.map((user) => user.jabatan)));
    const session = await authSessionService.createForUser({
        email_sat: input.matchedUser.email_sat,
        cabang: input.matchedUser.cabang,
        nama_lengkap: input.matchedUser.nama_lengkap,
        jabatan: input.matchedUser.jabatan,
        roles: jabatanList,
        nama_pt: input.matchedUser.nama_pt
    });

    if (jabatanList.length > 1) {
        return { ...input.matchedUser, jabatan: jabatanList, alamat_cabang, ...session };
    }

    return { ...input.matchedUser, alamat_cabang, ...session };
};

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

        if (isHeadOfficeCabang(matchedUser.cabang) && isOtpChallengeJabatan(matchedUser.jabatan)) {
            const otp = await authOtpService.createAndSend({
                email_sat: matchedUser.email_sat,
                cabang: matchedUser.cabang,
                nama_lengkap: matchedUser.nama_lengkap
            });

            return {
                requires_otp: true,
                otp_token: otp.otp_token,
                otp_expires_at: otp.otp_expires_at,
                email_sat: matchedUser.email_sat,
                cabang: matchedUser.cabang
            };
        }

        return buildLoginResponse({ matchedUser, registeredUsers });
    },

    async verifyLoginOtp(input: VerifyOtpInput) {
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

        if (!isHeadOfficeCabang(matchedUser.cabang) || !isOtpChallengeJabatan(matchedUser.jabatan)) {
            throw new AppError("OTP tidak diperlukan", 400);
        }

        await authOtpService.verify({
            email_sat: emailSat,
            cabang,
            otp_token: input.otp_token.trim(),
            otp_code: input.otp_code.trim()
        });

        return buildLoginResponse({ matchedUser, registeredUsers });
    }
};
