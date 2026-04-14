import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { pengawasanRepository, type PengawasanRow } from "./pengawasan.repository";
import type {
    CreatePengawasanInput,
    ListPengawasanQueryInput,
    UpdatePengawasanInput
} from "./pengawasan.schema";

type UploadedDokumentasiFile = {
    originalname: string;
    mimetype: string;
    buffer: Uint8Array;
};

type PgError = {
    code?: string;
    constraint?: string;
};

const toPgError = (error: unknown): PgError => {
    if (typeof error === "object" && error !== null) {
        return error as PgError;
    }

    return {};
};

const mapPgError = (error: unknown): never => {
    const pgError = toPgError(error);

    if (pgError.code === "23503" && pgError.constraint === "fk_pengawasan_gantt") {
        throw new AppError("id_gantt tidak ditemukan di tabel gantt_chart", 404);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_pengawasan_status") {
        throw new AppError("status harus bernilai progress, selesai, atau terlambat", 400);
    }

    throw error;
};

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedDokumentasiFile): string => {
    const fromName = (() => {
        const rawName = file.originalname ?? "";
        const lastDot = rawName.lastIndexOf(".");
        if (lastDot <= 0 || lastDot === rawName.length - 1) return "";
        return rawName.slice(lastDot).toLowerCase();
    })();

    if (/^\.[a-z0-9]{1,10}$/.test(fromName)) {
        return fromName;
    }

    if (file.mimetype === "application/pdf") return ".pdf";
    if (file.mimetype === "image/jpeg") return ".jpg";
    if (file.mimetype === "image/png") return ".png";
    if (file.mimetype === "image/webp") return ".webp";
    return ".bin";
};

const uploadDokumentasiToDrive = async (
    idGantt: number,
    file: UploadedDokumentasiFile
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;

    if (!drive) {
        throw new AppError("Google Drive belum terkonfigurasi", 500);
    }

    const safeGantt = sanitizeFilenamePart(String(idGantt), "gantt");
    const ext = resolveFileExtension(file);
    const filename = `PENGAWASAN_DOKUMENTASI_${safeGantt}_${Date.now()}${ext}`;

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        file.mimetype || "application/octet-stream",
        file.buffer,
        2,
        drive
    );

    if (result.webViewLink) {
        return result.webViewLink;
    }

    if (result.id) {
        return `https://drive.google.com/file/d/${result.id}/view`;
    }

    throw new AppError("Upload dokumentasi ke Google Drive gagal", 500);
};

export const pengawasanService = {
    async create(
        input: CreatePengawasanInput,
        uploadedDokumentasi?: UploadedDokumentasiFile
    ): Promise<PengawasanRow> {
        try {
            const dokumentasiLink = uploadedDokumentasi
                ? await uploadDokumentasiToDrive(input.id_gantt, uploadedDokumentasi)
                : undefined;

            const payload = dokumentasiLink
                ? { ...input, dokumentasi: dokumentasiLink }
                : input;

            return await pengawasanRepository.create(payload);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async createBulk(items: CreatePengawasanInput[]): Promise<PengawasanRow[]> {
        try {
            return await pengawasanRepository.createBulk(items);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async list(query: ListPengawasanQueryInput) {
        return pengawasanRepository.findAll(query);
    },

    async getById(id: string) {
        const data = await pengawasanRepository.findById(id);
        if (!data) {
            throw new AppError("Data pengawasan tidak ditemukan", 404);
        }

        return data;
    },

    async update(
        id: string,
        input: UpdatePengawasanInput,
        uploadedDokumentasi?: UploadedDokumentasiFile
    ): Promise<PengawasanRow> {
        try {
            const existing = await pengawasanRepository.findById(id);
            if (!existing) {
                throw new AppError("Data pengawasan tidak ditemukan", 404);
            }

            const dokumentasiLink = uploadedDokumentasi
                ? await uploadDokumentasiToDrive(existing.id_gantt, uploadedDokumentasi)
                : undefined;

            const payload = dokumentasiLink
                ? { ...input, dokumentasi: dokumentasiLink }
                : input;

            const data = await pengawasanRepository.updateById(id, payload);
            if (!data) {
                throw new AppError("Data pengawasan tidak ditemukan", 404);
            }

            return data;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            return mapPgError(error);
        }
    },

    async remove(id: string) {
        const deleted = await pengawasanRepository.deleteById(id);
        if (!deleted) {
            throw new AppError("Data pengawasan tidak ditemukan", 404);
        }

        return { id: Number(id), deleted: true };
    }
};
