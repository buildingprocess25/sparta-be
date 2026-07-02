import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
import { getBranchScopeCandidates } from "../../common/branch-scope";
import { pool } from "../../db/pool";
import { authSessionService, type AuthenticatedUser } from "./auth-session.service";
import { canManageSystemMaintenance, systemMaintenanceService } from "../system-maintenance/system-maintenance.service";

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

const PUBLIC_API_PATHS = new Set([
    "/api/auth/login",
    "/api/auth/verify-otp"
]);

const GLOBAL_ACCESS_ROLES = [
    "BUILDING & MAINTENANCE SUPER HUMAN",
    "BUILDING & MAINTENANCE REGIONAL MANAGER",
    "BUILDING MAINTENANCE & ENERGY SYSTEM MANAGER",
    "BUILDING & MAINTENANCE GENERAL MANAGER",
    "STORE & BRANCH CONTROLLING SPECIALIST"
];

const MAINTENANCE_STATUS_CACHE_MS = 5_000;
let cachedMaintenanceStatus: { isActive: boolean; expiresAt: number } | null = null;

function normalizeText(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/^CAB(?:ANG)?\.?\s+/, "")
        .replace(/^CABANG\s+/, "")
        .replace(/\s+/g, " ");
}

function hasGlobalAccess(user: AuthenticatedUser): boolean {
    if (normalizeText(user.cabang) === "HEAD OFFICE") return true;
    return user.roles.some((role) => GLOBAL_ACCESS_ROLES.includes(normalizeText(role)));
}

function isBranchSupportRole(user: AuthenticatedUser): boolean {
    return user.roles.some((role) => normalizeText(role).includes("BRANCH BUILDING SUPPORT"));
}

async function getUserCoverageBranches(user: AuthenticatedUser): Promise<string[]> {
    const result = await pool.query<{ covered_cabang: string }>(
        `
        SELECT DISTINCT ubc.covered_cabang
        FROM user_cabang uc
        JOIN user_branch_coverage ubc ON ubc.user_cabang_id = uc.id
        WHERE LOWER(TRIM(uc.email_sat)) = LOWER(TRIM($1))
          AND LOWER(TRIM(uc.cabang)) = LOWER(TRIM($2))
        ORDER BY ubc.covered_cabang ASC
        `,
        [user.email_sat, user.cabang]
    );

    return result.rows.map(row => normalizeText(row.covered_cabang)).filter(Boolean);
}

async function canAccessRequestedBranch(user: AuthenticatedUser, requestedCabang: string): Promise<boolean> {
    const normalizedRequested = normalizeText(requestedCabang);
    const normalizedUserCabang = normalizeText(user.cabang);
    if (!normalizedRequested || ["ALL", "SEMUA", "SEMUA CABANG", "-"].includes(normalizedRequested)) return true;

    if (isBranchSupportRole(user)) {
        return getBranchScopeCandidates(normalizedUserCabang).includes(normalizedRequested);
    }

    const coverage = await getUserCoverageBranches(user);
    if (coverage.length > 0) return coverage.includes(normalizedRequested);
    return normalizedRequested === normalizedUserCabang;
}

async function isMaintenanceActive(): Promise<boolean> {
    const now = Date.now();
    if (cachedMaintenanceStatus && cachedMaintenanceStatus.expiresAt > now) {
        return cachedMaintenanceStatus.isActive;
    }

    const status = await systemMaintenanceService.getStatus();
    cachedMaintenanceStatus = {
        isActive: status.is_active,
        expiresAt: now + MAINTENANCE_STATUS_CACHE_MS,
    };
    return status.is_active;
}

function rejectForMaintenance(res: Response): void {
    res.status(503).json({
        status: "maintenance",
        message: "Sistem sedang dalam pemeliharaan. Akses sementara dibatasi agar pembaruan dapat berjalan stabil. Silakan kembali beberapa saat lagi."
    });
}

function getStringValue(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0].trim();
    return null;
}

async function validateScopedRequest(req: Request, res: Response): Promise<boolean> {
    const user = req.user;
    if (!user || hasGlobalAccess(user)) return true;

    // Skip branch scope check for price data endpoints - these are reference data accessible to all contractors
    const path = req.path;
    if (path === "/get-data" || path === "/get-data-price-rab" || path === "/api/get-data" || path === "/api/get-data-price-rab") {
        return true;
    }

    const requestedCabang = getStringValue(req.query.cabang) ?? getStringValue((req.body as Record<string, unknown> | undefined)?.cabang);
    if (requestedCabang) {
        if (!(await canAccessRequestedBranch(user, requestedCabang))) {
            res.status(403).json({
                status: "error",
                message: "Anda tidak memiliki akses ke cabang yang diminta."
            });
            return false;
        }
    }

    const actorEmail =
        getStringValue(req.query.actor_email)
        ?? getStringValue((req.body as Record<string, unknown> | undefined)?.actor_email)
        ?? getStringValue((req.body as Record<string, unknown> | undefined)?.approver_email)
        ?? getStringValue((req.body as Record<string, unknown> | undefined)?.uploader_email);

    if (actorEmail && normalizeText(actorEmail) !== normalizeText(user.email_sat)) {
        res.status(403).json({
            status: "error",
            message: "Identitas pemohon tidak sesuai dengan sesi login."
        });
        return false;
    }

    return true;
}

function extractBearerToken(req: Request): string | null {
    const authorization = req.get("authorization") ?? "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();

    const queryToken = req.query.access_token;
    if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();

    return null;
}

function isProtectedPath(path: string): boolean {
    if (PUBLIC_API_PATHS.has(path)) return false;
    if (path === "/health") return false;
    if (path === "/get-data" || path === "/get-data-price-rab") return true;
    return path.startsWith("/api/");
}

function isMaintenanceControlPath(path: string): boolean {
    return path === "/api/system-maintenance/status";
}

export async function apiAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.method === "OPTIONS") {
        return next();
    }

    if (req.method === "GET" && isMaintenanceControlPath(req.path)) {
        return next();
    }

    if (!isProtectedPath(req.path)) {
        return next();
    }

    const token = extractBearerToken(req);
    if (token) {
        try {
            const user = await authSessionService.authenticateToken(token);
            if (user) {
                req.user = user;
                if (
                    await isMaintenanceActive()
                    && !canManageSystemMaintenance(user)
                    && !isMaintenanceControlPath(req.path)
                ) {
                    rejectForMaintenance(res);
                    return;
                }
                if (env.AUTH_ENFORCEMENT_MODE === "strict" && !(await validateScopedRequest(req, res))) {
                    return;
                }
                return next();
            }
        } catch (error) {
            console.warn("Gagal membaca session auth:", error);
        }
    }

    if (env.AUTH_ENFORCEMENT_MODE === "compat") {
        if (await isMaintenanceActive() && !isMaintenanceControlPath(req.path)) {
            rejectForMaintenance(res);
            return;
        }
        console.warn("[AUTH][compat] Request tanpa session valid:", {
            method: req.method,
            path: req.originalUrl
        });
        return next();
    }

    return res.status(401).json({
        status: "error",
        message: "Sesi tidak valid atau sudah berakhir. Silakan login kembali."
    });
}
