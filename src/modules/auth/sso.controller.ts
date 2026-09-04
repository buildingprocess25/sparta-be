import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { AppError } from "../../common/app-error";
import { tokoService, cleanUpBranchGroups } from "../toko/toko.service";
import { env } from "../../config/env";
import { tokoRepository } from "../toko/toko.repository";
import { authSessionService } from "./auth-session.service";
import { userCabangRepository } from "../user-cabang/user-cabang.repository";
import { userBranchCoverageRepository } from "../user-branch-coverage/user-branch-coverage.repository";

// Kita tidak punya env.LOGIN_SPARTA_API_URL secara default, jadi kita hardcode untuk demo, atau ambil dari env.
// Menurut standar, portal berjalan di port 3002 atau 10002.
const SSO_EXCHANGE_URL = process.env.SSO_EXCHANGE_URL || "http://localhost:10000/v1/sso/exchange";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const ssoCallback = asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    
    if (!token) {
        return res.redirect(`${FRONTEND_URL}/auth?error=invalid_sso_token`);
    }

    try {
        // 1. Tukarkan token dengan login-sparta
        const exchangeRes = await fetch(SSO_EXCHANGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleId: "building", launchToken: token })
        });

        if (!exchangeRes.ok) {
            console.error("SSO Exchange failed:", await exchangeRes.text());
            return res.redirect(`${FRONTEND_URL}/auth?error=sso_exchange_failed`);
        }

        const exchangeData = await exchangeRes.json();
        const email = exchangeData.data?.user?.email;

        if (!email) {
            return res.redirect(`${FRONTEND_URL}/auth?error=sso_no_email`);
        }

        // 2. Cari email di database user_cabang
        const registeredUsers = await tokoRepository.findUserCabangByEmailSatAll(email);
        
        if (registeredUsers.length === 0) {
            return res.redirect(`${FRONTEND_URL}/auth?error=user_not_found`);
        }

        // 3. Buat temporary JWT/Token untuk dilempar ke Frontend agar Frontend bisa membuka modal "Pilih Akun" atau langsung login
        // Karena kita butuh Frontend mengeksekusi POST /api/auth/login, kita bisa encode data ini dalam base64
        // Atau buat temporary session khusus SSO.
        // Cara paling aman dan simpel untuk demo: Kita lempar sso_temp_email ke frontend.
        // TAPI karena ini hanya Frontend kita sendiri, kita bisa pakai JWT rahasia, atau cukup URL param.
        
        // Agar persis seperti sistem lama, kita lempar `sso_email` ke Frontend
        // Frontend akan menyerap `sso_email` ini, dan memanggil endpoint baru `POST /api/auth/sso/resolve`
        
        const payload = Buffer.from(JSON.stringify({ email })).toString("base64");
        return res.redirect(`${FRONTEND_URL}/auth?sso_payload=${payload}`);

    } catch (error) {
        console.error("SSO Callback Error:", error);
        return res.redirect(`${FRONTEND_URL}/auth?error=sso_server_error`);
    }
});

export const ssoResolve = asyncHandler(async (req: Request, res: Response) => {
    const { payload, cabang, user_cabang_id } = req.body;
    
    if (!payload) throw new AppError("Payload missing", 400);
    
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    const email = decoded.email;

    let registeredUsers = await tokoRepository.findUserCabangByEmailSatAll(email);
    registeredUsers = cleanUpBranchGroups(registeredUsers);
    
    if (registeredUsers.length === 0) {
        throw new AppError("email belum terdaftar", 404);
    }

    // Jika user belum memilih cabang (cabang kosong)
    if (!cabang) {
        if (registeredUsers.length === 1) {
            // Langsung login!
            const matchedUser = registeredUsers[0];
            const response = await buildLoginResponse({ matchedUser });
            return res.json({ status: "success", data: response });
        } else {
            // Perlu pilih cabang
            return res.json({ 
                status: "success", 
                data: {
                    requires_account_selection: true,
                    available_roles: registeredUsers
                }
            });
        }
    }

    // Jika user sudah memilih cabang
    const branchCandidates = registeredUsers.filter(
        (user) => user.cabang.toLowerCase() === cabang.toLowerCase()
    );

    if (branchCandidates.length === 0) {
        throw new AppError("cabang tidak valid", 400);
    }

    let matchedUser = branchCandidates[0];
    if (branchCandidates.length > 1) {
        if (!user_cabang_id) {
            return res.json({ 
                status: "success", 
                data: {
                    requires_account_selection: true,
                    available_roles: branchCandidates
                }
            });
        }
        const specific = branchCandidates.find(u => u.id === Number(user_cabang_id));
        if (!specific) throw new AppError("role tidak valid", 400);
        matchedUser = specific;
    }

    const response = await buildLoginResponse({ matchedUser });
    return res.json({ status: "success", data: response });
});

// Helper dari toko.service.ts
const buildLoginResponse = async (input: { matchedUser: any }) => {
    const alamatCabangRow = await tokoRepository.findAlamatCabangByCabang(input.matchedUser.cabang);
    const alamat_cabang = alamatCabangRow?.alamat ?? null;
    const coverage = await userBranchCoverageRepository.findCoveredBranchesByUserCabangId(input.matchedUser.id);
    const session = await authSessionService.createForUser({
        email_sat: input.matchedUser.email_sat,
        cabang: input.matchedUser.cabang,
        nama_lengkap: input.matchedUser.nama_lengkap,
        jabatan: input.matchedUser.jabatan,
        roles: [input.matchedUser.jabatan],
        nama_pt: input.matchedUser.nama_pt
    });
    await userCabangRepository.updateLastLoginById(input.matchedUser.id);

    return { ...input.matchedUser, coverage, alamat_cabang, ...session };
};
