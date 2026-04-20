import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { opnameRepository, type OpnameRow } from "./opname.repository";
import type {
    CreateOpnameData,
    CreateOpnameInput,
    ListOpnameQueryInput,
    UpdateOpnameInput
} from "./opname.schema";

type UploadedFotoOpnameFile = {
    originalname: string;
    mimetype: string;
    buffer: Parameters<GoogleProvider["uploadFile"]>[3];
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

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_toko") {
        throw new AppError("id_toko tidak ditemukan di tabel toko", 404);
    }

    if (pgError.code === "23503" && pgError.constraint === "fk_opname_rab_item") {
        throw new AppError("id_rab_item tidak ditemukan di tabel rab_item", 404);
    }

    if (pgError.code === "23514" && pgError.constraint === "chk_opname_status") {
        throw new AppError("status opname tidak valid (gunakan: pending, disetujui, ditolak)", 400);
    }

    throw error;
};

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedFotoOpnameFile): string => {
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

const uploadFotoOpnameToDrive = async (
    idToko: number,
    file: UploadedFotoOpnameFile
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;

    if (!drive) {
        throw new AppError("Google Drive belum terkonfigurasi", 500);
    }

    const safeToko = sanitizeFilenamePart(String(idToko), "toko");
    const ext = resolveFileExtension(file);
    const filename = `OPNAME_FOTO_${safeToko}_${Date.now()}${ext}`;

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

    throw new AppError("Upload foto opname ke Google Drive gagal", 500);
};

export const opnameService = {
    async create(
        input: CreateOpnameInput,
        uploadedFotoOpname?: UploadedFotoOpnameFile
    ): Promise<OpnameRow> {
        try {
            const fotoLink = uploadedFotoOpname
                ? await uploadFotoOpnameToDrive(input.id_toko, uploadedFotoOpname)
                : undefined;

            const payload: CreateOpnameData = fotoLink
                ? { ...input, foto: fotoLink }
                : input;

            return await opnameRepository.create(payload);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async createBulk(
        items: CreateOpnameInput[],
        uploadedFotoOpnameFiles: UploadedFotoOpnameFile[] = [],
        uploadedFotoOpnameIndexes?: number[]
    ): Promise<OpnameRow[]> {
        try {
            if (uploadedFotoOpnameFiles.length === 0) {
                return await opnameRepository.createBulk(items);
            }

            if (uploadedFotoOpnameIndexes && uploadedFotoOpnameIndexes.length > 0) {
                if (uploadedFotoOpnameIndexes.length !== uploadedFotoOpnameFiles.length) {
                    throw new AppError(
                        "Jumlah file_foto_opname_indexes harus sama dengan jumlah file_foto_opname",
                        400
                    );
                }

                const usedIndexes = new Set<number>();
                const payloadWithFoto: CreateOpnameData[] = items.map((item) => ({ ...item }));

                for (let filePosition = 0; filePosition < uploadedFotoOpnameFiles.length; filePosition++) {
                    const itemIndex = uploadedFotoOpnameIndexes[filePosition];
                    if (itemIndex < 0 || itemIndex >= items.length) {
                        throw new AppError(
                            `file_foto_opname_indexes[${filePosition}] di luar range items (0-${items.length - 1})`,
                            400
                        );
                    }

                    if (usedIndexes.has(itemIndex)) {
                        throw new AppError(
                            `file_foto_opname_indexes tidak boleh duplikat (duplikat di index item ${itemIndex})`,
                            400
                        );
                    }
                    usedIndexes.add(itemIndex);

                    const item = items[itemIndex];
                    const fotoLink = await uploadFotoOpnameToDrive(item.id_toko, uploadedFotoOpnameFiles[filePosition]);
                    payloadWithFoto[itemIndex] = {
                        ...item,
                        foto: fotoLink
                    };
                }

                return await opnameRepository.createBulk(payloadWithFoto);
            }

            if (uploadedFotoOpnameFiles.length !== 1 && uploadedFotoOpnameFiles.length !== items.length) {
                throw new AppError(
                    "Jumlah file_foto_opname harus 1 file untuk semua item, sama dengan jumlah items, atau kirim file_foto_opname_indexes untuk mapping item tertentu",
                    400
                );
            }

            const payloadWithFoto: CreateOpnameData[] = [];
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const file = uploadedFotoOpnameFiles.length === 1
                    ? uploadedFotoOpnameFiles[0]
                    : uploadedFotoOpnameFiles[index];

                if (!file) {
                    payloadWithFoto.push(item);
                    continue;
                }

                const fotoLink = await uploadFotoOpnameToDrive(item.id_toko, file);
                payloadWithFoto.push({
                    ...item,
                    foto: fotoLink
                });
            }

            return await opnameRepository.createBulk(payloadWithFoto);
        } catch (error) {
            return mapPgError(error);
        }
    },

    async list(query: ListOpnameQueryInput) {
        return opnameRepository.findAll(query);
    },

    async getById(id: string) {
        const data = await opnameRepository.findById(id);
        if (!data) {
            throw new AppError("Data opname tidak ditemukan", 404);
        }

        return data;
    },

    async update(
        id: string,
        input: UpdateOpnameInput,
        uploadedFotoOpname?: UploadedFotoOpnameFile
    ): Promise<OpnameRow> {
        try {
            const existing = await opnameRepository.findById(id);
            if (!existing) {
                throw new AppError("Data opname tidak ditemukan", 404);
            }

            const fotoLink = uploadedFotoOpname
                ? await uploadFotoOpnameToDrive(existing.id_toko, uploadedFotoOpname)
                : undefined;

            const payload = fotoLink
                ? { ...input, foto: fotoLink }
                : input;

            const data = await opnameRepository.updateById(id, payload);
            if (!data) {
                throw new AppError("Data opname tidak ditemukan", 404);
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
        const deleted = await opnameRepository.deleteById(id);
        if (!deleted) {
            throw new AppError("Data opname tidak ditemukan", 404);
        }

        return { id: Number(id), deleted: true };
    }
};
