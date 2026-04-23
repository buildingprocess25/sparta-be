import cors from "cors";
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
app.use("/api/pengawasan", pengawasanRouter);
app.use("/api/opname", opnameRouter);
app.use("/api/final_opname", opnameFinalRouter);
app.use("/api/user_cabang", userCabangRouter);
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

    console.error("Unhandled error:", error);
    return res.status(500).json({
        status: "error",
        message: "Terjadi kesalahan internal server"
    });
});

export { app };
