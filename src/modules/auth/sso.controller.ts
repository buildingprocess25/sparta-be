import type { Request, Response } from "express";
import { asyncHandler } from "../../common/async-handler";
import { AppError } from "../../common/app-error";
import { tokoService, cleanUpBranchGroups } from "../toko/toko.service";
import { env } from "../../config/env";
import { tokoRepository } from "../toko/toko.repository";
import { authSessionService } from "./auth-session.service";
import { userCabangRepository } from "../user-cabang/user-cabang.repository";
import { userBranchCoverageRepository } from "../user-branch-coverage/user-branch-coverage.repository";

import jwt from "jsonwebtoken";

// Kita tidak punya env.LOGIN_SPARTA_API_URL secara default, jadi kita hardcode untuk demo, atau ambil dari env.
// Menurut standar, portal berjalan di port 3002 atau 10002.
const SSO_EXCHANGE_URL = process.env.SSO_EXCHANGE_URL || "http://localhost:10000/v1/sso/exchange";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3002";
const SSO_JWT_SECRET = process.env.SSO_JWT_SECRET || "building_sso_secret_key_12345";

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

        // 3. Buat JWT terenkripsi untuk dilempar ke Frontend
        const payload = jwt.sign({ email }, SSO_JWT_SECRET, { expiresIn: "5m" });
        return res.redirect(`${FRONTEND_URL}/auth?sso_payload=${payload}`);

    } catch (error) {
        console.error("SSO Callback Error:", error);
        return res.redirect(`${FRONTEND_URL}/auth?error=sso_server_error`);
    }
});

export const ssoResolve = asyncHandler(async (req: Request, res: Response) => {
    const { payload, cabang, user_cabang_id } = req.body;
    
    if (!payload) throw new AppError("Payload missing", 400);
    
    let decoded: any;
    try {
        decoded = jwt.verify(payload, SSO_JWT_SECRET);
    } catch (err) {
        throw new AppError("Token tidak valid atau kedaluwarsa", 401);
    }
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

export const ssoWebhookEmail = asyncHandler(async (req: Request, res: Response) => {
    const internalKey = req.headers["x-sparta-internal-key"];
    const expectedKey = process.env.SPARTA_INTERNAL_API_KEY || "sparta-internal-sync-key-2026";
    
    if (internalKey !== expectedKey) {
        throw new AppError("Akses ditolak", 401);
    }
    
    const { oldEmail, newEmail } = req.body;
    
    if (!oldEmail || !newEmail) {
        throw new AppError("Missing oldEmail or newEmail", 400);
    }
    
    // Update all users matching the oldEmail to newEmail in user_cabang
    const db = await import("../../db/knex");
    const knex = db.default || db.knex;
    
    await knex("user_cabang")
        .whereRaw("LOWER(email_sat) = LOWER(?)", [oldEmail])
        .update({ email_sat: newEmail });
        
    return res.json({ status: "success", data: { ok: true } });
});
