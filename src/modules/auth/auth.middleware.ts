import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
import { isSameBranchScope } from "../../common/branch-scope";
import { authSessionService, type AuthenticatedUser } from "./auth-session.service";

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

const MAINTENANCE_LOCK_DATE = "2026-07-01";
const MAINTENANCE_LOCK_START_MINUTES = 17 * 60;

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

function hasSuperHumanAccess(user: AuthenticatedUser): boolean {
    return user.roles.some((role) => normalizeText(role).includes("SUPER HUMAN"));
}

function getJakartaNow() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());

    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    const hour = Number(value("hour"));
    const minute = Number(value("minute"));

    return {
        date: `${value("year")}-${value("month")}-${value("day")}`,
        totalMinutes: hour * 60 + minute
    };
}

function isWithinMaintenanceLock(): boolean {
    const jakartaNow = getJakartaNow();
    return (
        jakartaNow.date === MAINTENANCE_LOCK_DATE
        && jakartaNow.totalMinutes >= MAINTENANCE_LOCK_START_MINUTES
    );
}

function rejectForMaintenance(res: Response): void {
    res.status(503).json({
        status: "maintenance",
        message: "SPARTA sedang dalam maintenance mulai Rabu, 1 Juli 2026 pukul 17:00 WIB. Akses sementara hanya dibuka untuk akun Super Human."
    });
}

function getStringValue(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0].trim();
    return null;
}

function validateScopedRequest(req: Request, res: Response): boolean {
    const user = req.user;
    if (!user || hasGlobalAccess(user)) return true;

    const requestedCabang = getStringValue(req.query.cabang) ?? getStringValue((req.body as Record<string, unknown> | undefined)?.cabang);
    if (requestedCabang) {
        const normalizedRequested = normalizeText(requestedCabang);
        const normalizedUserCabang = normalizeText(user.cabang);
        const isWildcard = ["ALL", "SEMUA", "SEMUA CABANG", "-"].includes(normalizedRequested);

        if (!isWildcard && !isSameBranchScope(normalizedRequested, normalizedUserCabang)) {
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

export async function apiAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.method === "OPTIONS") {
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
                if (isWithinMaintenanceLock() && !hasSuperHumanAccess(user)) {
                    rejectForMaintenance(res);
                    return;
                }
                if (env.AUTH_ENFORCEMENT_MODE === "strict" && !validateScopedRequest(req, res)) {
                    return;
                }
                return next();
            }
        } catch (error) {
            console.warn("Gagal membaca session auth:", error);
        }
    }

    if (env.AUTH_ENFORCEMENT_MODE === "compat") {
        if (isWithinMaintenanceLock()) {
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
