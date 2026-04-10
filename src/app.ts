import cors from "cors";
import express from "express";
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
import { getKontraktor, loginUserCabang } from "./modules/toko/toko.controller";



const app = express();

const corsOrigins = env.CORS_ORIGINS === "*"
    ? "*"
    : env.CORS_ORIGINS.split(",").map((item) => item.trim());

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "50mb" }));

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
app.use("/", priceRabRouter);
app.use("/api", priceRabRouter);

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
