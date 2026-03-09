import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { env } from "./config/env";
import { AppError } from "./common/app-error";
import { tokoRouter } from "./modules/toko/toko.routes";
import { rabRouter } from "./modules/rab/rab.routes";
import { spkRouter } from "./modules/spk/spk.routes";

const app = express();

const corsOrigins = env.CORS_ORIGINS === "*"
    ? "*"
    : env.CORS_ORIGINS.split(",").map((item) => item.trim());

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "sparta-api" });
});

app.use("/api/toko", tokoRouter);
app.use("/api/rab", rabRouter);
app.use("/api/spk", spkRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
        return res.status(422).json({
            status: "error",
            message: "Validasi request gagal",
            issues: error.issues
        });
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            status: "error",
            message: error.message
        });
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({
        status: "error",
        message: "Terjadi kesalahan internal server"
    });
});

export { app };
