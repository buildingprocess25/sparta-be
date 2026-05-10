import cors from "cors";
import crypto from "crypto";
import express from "express";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "./config/env";
import { AppError } from "./common/app-error";
import { tokoRouter } from "./modules/toko/toko.routes";
import { rabRouter } from "./modules/rab/rab.routes";
import { spkRouter } from "./modules/spk/spk.routes";
import { documentRouter } from "./modules/document/document.routes";
import { dokumentasiRouter } from "./modules/dokumentasi/dokumentasi.routes";
import { ganttRouter } from "./modules/gantt/gantt.routes";
import { priceRabRouter } from "./modules/price-rab/price-rab.routes";
import { pertambahanSpkRouter } from "./modules/pertambahan-spk/pertambahan-spk.routes";
import { picPengawasanRouter } from "./modules/pic-pengawasan/pic-pengawasan.routes";
import { pengawasanRouter } from "./modules/pengawasan/pengawasan.routes";
import { opnameRouter } from "./modules/opname/opname.routes";
import { opnameFinalRouter } from "./modules/opname-final/opname-final.routes";
import { userCabangRouter } from "./modules/user-cabang/user-cabang.routes";
import { instruksiLapanganRouter } from "./modules/instruksi-lapangan/instruksi-lapangan.routes";
import { serahTerimaRouter } from "./modules/serah-terima/serah-terima.routes";
import { getKontraktor, loginUserCabang } from "./modules/toko/toko.controller";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { emailNotificationRouter } from "./modules/email-notification/email-notification.routes";
import { projekPlanningRouter } from "./modules/projek-planning/projek-planning.routes";



const app = express();

const corsOrigins = env.CORS_ORIGINS === "*"
    ? "*"
    : env.CORS_ORIGINS.split(",").map((item) => item.trim());

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "50mb" }));

app.use((req, res, next) => {
    const redactKeys = new Set([
        "password",
        "passwd",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "auth",
        "secret",
        "api_key",
    ]);

    const sanitizeValue = (value: unknown, depth = 0): unknown => {
        if (depth > 2) return "[depth]";
        if (value === null || value === undefined) return value;
        if (Buffer.isBuffer(value)) return `[buffer ${value.length}]`;
        if (typeof value === "string") {
            return value.length > 200 ? `${value.slice(0, 200)}...` : value;
        }
        if (typeof value === "number" || typeof value === "boolean") return value;
        if (Array.isArray(value)) {
            const trimmed = value.slice(0, 5).map((item) => sanitizeValue(item, depth + 1));
            return value.length > 5 ? [...trimmed, "[+more]"] : trimmed;
        }
        if (typeof value === "object") {
            const result: Record<string, unknown> = {};
            for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
                if (redactKeys.has(key.toLowerCase())) {
                    result[key] = "[redacted]";
                } else {
                    result[key] = sanitizeValue(raw, depth + 1);
                }
            }
            return result;
        }
        return String(value);
    };

    const requestId = crypto.randomUUID();
    res.locals.requestId = requestId;

    const startAt = Date.now();
    const method = req.method;
    const path = req.originalUrl;
    const ip = req.ip;
    const userAgent = req.get("user-agent") || "-";
    const contentLength = req.get("content-length") || "-";

    const payloadLog = {
        ip,
        user_agent: userAgent,
        content_length: contentLength,
        params: sanitizeValue(req.params),
        query: sanitizeValue(req.query),
        body: sanitizeValue(req.body)
    };

    console.log(`[REQ][${requestId}] ${method} ${path}`, payloadLog);

    res.on("finish", () => {
        const durationMs = Date.now() - startAt;
        console.log(`[RES][${requestId}] ${method} ${path}`, {
            status: res.statusCode,
            duration_ms: durationMs
        });
    });

    next();
});

app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "sparta-api" });
});

app.use("/api/toko", tokoRouter);
app.post("/api/auth/login", loginUserCabang);
app.get("/api/get_kontraktor", getKontraktor);
app.use("/api/rab", rabRouter);
app.use("/api/spk", spkRouter);
app.use("/api/doc", documentRouter);
app.use("/api/dok", dokumentasiRouter);
app.use("/api/gantt", ganttRouter);
app.use("/api/pertambahan-spk", pertambahanSpkRouter);
app.use("/api/pic_pengawasan", picPengawasanRouter);
app.use("/api/pengawasan", pengawasanRouter);
app.use("/api/opname", opnameRouter);
app.use("/api/final_opname", opnameFinalRouter);
app.use("/api/user_cabang", userCabangRouter);
app.use("/api/instruksi-lapangan", instruksiLapanganRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/projek-planning", projekPlanningRouter);
app.use("/api", emailNotificationRouter);
app.use("/api", serahTerimaRouter);
app.use("/", priceRabRouter);
app.use("/api", priceRabRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = res.locals.requestId as string | undefined;
    if (error instanceof ZodError) {
        return res.status(422).json({
            status: "error",
            message: "Validasi request gagal",
            issues: error.issues,
            debug_body: _req.body,
        });
    }

    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                status: "error",
                message: "Ukuran file melebihi batas maksimal 10MB per file"
            });
        }

        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                status: "error",
                message: `Field file tidak valid atau jumlah file melebihi batas untuk field: ${error.field || "unknown"}`
            });
        }

        return res.status(400).json({
            status: "error",
            message: `Upload file gagal (${error.code})`
        });
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            status: "error",
            message: error.message
        });
    }

    console.error("Unhandled error:", {
        request_id: requestId ?? "-",
        error
    });
    return res.status(500).json({
        status: "error",
        message: "Terjadi kesalahan internal server"
    });
});

export { app };
