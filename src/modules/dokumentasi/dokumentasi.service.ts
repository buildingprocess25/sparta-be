import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { buildDokumentasiBangunanPdfBuffer } from "./dokumentasi.pdf";
import {
    dokumentasiBangunanRepository,
    type DokumentasiBangunanDetail,
    type DokumentasiBangunanItemRow,
    type DokumentasiBangunanRow
} from "./dokumentasi.repository";
import type {
    DokumentasiBangunanCreateInput,
    DokumentasiBangunanListQueryInput,
    DokumentasiBangunanUpdateInput
} from "./dokumentasi.schema";

export type UploadedDokumentasiFile = Express.Multer.File;
type DokumentasiItemFile = {
    file: UploadedDokumentasiFile;
    itemIndex: number;
};

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedDokumentasiFile): string => {
    const rawName = file.originalname ?? "";
    const lastDot = rawName.lastIndexOf(".");
    if (lastDot > 0 && lastDot < rawName.length - 1) {
        const ext = rawName.slice(lastDot).toLowerCase();
        if (/^\.[a-z0-9]{1,10}$/.test(ext)) return ext;
    }

    if (file.mimetype === "application/pdf") return ".pdf";
    if (file.mimetype === "image/jpeg") return ".jpg";
    if (file.mimetype === "image/png") return ".png";
    if (file.mimetype === "image/webp") return ".webp";
    return ".bin";
};

const resolveDriveLink = (fileId?: string, webViewLink?: string | null): string => {
    if (webViewLink) {
        const fid = webViewLink.split("/d/")[1]?.split("/")[0] ?? "";
        if (fid) {
            return `https://drive.google.com/uc?export=view&id=${fid}`;
        }
        return webViewLink;
    }

    if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    return "";
};

const extractDriveFileId = (link?: string | null): string | null => {
    if (!link) return null;

    const idFromFile = /\/file\/d\/([^/]+)/.exec(link)?.[1];
    if (idFromFile) return idFromFile;

    const idFromUc = /[?&]id=([^&]+)/.exec(link)?.[1];
    if (idFromUc) return idFromUc;

    return null;
};

const resolveDokumentasiFolderId = async (row: DokumentasiBangunanRow): Promise<string> => {
    const gp = GoogleProvider.instance;
    const root = env.DOC_BANGUNAN_DRIVE_FOLDER_ID;
    if (!root) {
        throw new AppError("DOC_BANGUNAN_DRIVE_FOLDER_ID belum diset", 500);
    }

    const kodeToko = sanitizeFilenamePart(row.kode_toko ?? undefined, "TOKO");
    const nomorUlok = sanitizeFilenamePart(row.nomor_ulok ?? undefined, "ULOK");
    const folderName = `DOKUMENTASI_${row.id}_${kodeToko}_${nomorUlok}`;
    return gp.getOrCreateFolder(folderName, root);
};

const uploadFotoItemsBulk = async (
    dokumentasi: DokumentasiBangunanRow,
    files: UploadedDokumentasiFile[]
): Promise<DokumentasiBangunanItemRow[]> => {
    if (files.length === 0) return [];

    const gp = GoogleProvider.instance;
    const folderId = await resolveDokumentasiFolderId(dokumentasi);
    const linkResults: string[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeKode = sanitizeFilenamePart(dokumentasi.kode_toko ?? undefined, "TOKO");
        const ext = resolveFileExtension(file);
        const filename = `FOTO_${safeKode}_${dokumentasi.id}_${Date.now()}_${i + 1}${ext}`;

        const uploaded = await gp.uploadFile(
            folderId,
            filename,
            file.mimetype || "application/octet-stream",
            file.buffer
        );

        const link = resolveDriveLink(uploaded.id, uploaded.webViewLink ?? null);
        if (link) {
            linkResults.push(link);
        }
    }

    return dokumentasiBangunanRepository.createItemsBulk(dokumentasi.id, linkResults);
};

const uploadFotoItemsByIndex = async (
    dokumentasi: DokumentasiBangunanRow,
    itemFiles: DokumentasiItemFile[]
): Promise<DokumentasiBangunanItemRow[]> => {
    if (itemFiles.length === 0) return [];

    const gp = GoogleProvider.instance;
    const folderId = await resolveDokumentasiFolderId(dokumentasi);
    const linkResults: string[] = [];
    const safeKode = sanitizeFilenamePart(dokumentasi.kode_toko ?? undefined, "TOKO");

    const ordered = [...itemFiles].sort((a, b) => a.itemIndex - b.itemIndex);
    for (const entry of ordered) {
        const ext = resolveFileExtension(entry.file);
        const filename = `FOTO_ITEM_${safeKode}_${dokumentasi.id}_${entry.itemIndex}${ext}`;

        const uploaded = await gp.uploadFile(
            folderId,
            filename,
            entry.file.mimetype || "application/octet-stream",
            entry.file.buffer
        );

        const link = resolveDriveLink(uploaded.id, uploaded.webViewLink ?? null);
        if (link) {
            linkResults.push(link);
        }
    }

    return dokumentasiBangunanRepository.createItemsBulk(dokumentasi.id, linkResults);
};

const splitItemFiles = (files: UploadedDokumentasiFile[]) => {
    const itemFiles: DokumentasiItemFile[] = [];
    const bulkFiles: UploadedDokumentasiFile[] = [];
    const seenIndexes = new Set<number>();
    const itemRegex = /^foto_items_(\d+)$/i;

    for (const file of files) {
        const field = file.fieldname ?? "";
        const match = itemRegex.exec(field);
        if (match) {
            const index = Number(match[1]);
            if (Number.isFinite(index) && index > 0 && !seenIndexes.has(index)) {
                itemFiles.push({ file, itemIndex: index });
                seenIndexes.add(index);
            }
            continue;
        }

        if (field === "foto") {
            bulkFiles.push(file);
        }
    }

    return { itemFiles, bulkFiles };
};

const uploadPdfToDrive = async (folderId: string, buffer: Buffer, filename: string): Promise<string> => {
    const gp = GoogleProvider.instance;
    const uploaded = await gp.uploadFile(folderId, filename, "application/pdf", buffer);
    return uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`;
};

export const dokumentasiBangunanService = {
    async create(input: DokumentasiBangunanCreateInput, files: UploadedDokumentasiFile[]) {
        const dokumentasi = await dokumentasiBangunanRepository.create(input);
        const { itemFiles, bulkFiles } = splitItemFiles(files);
        const items = itemFiles.length > 0
            ? await uploadFotoItemsByIndex(dokumentasi, itemFiles)
            : await uploadFotoItemsBulk(dokumentasi, bulkFiles.length > 0 ? bulkFiles : files);

        const detail = await dokumentasiBangunanRepository.getDetail(dokumentasi.id);
        if (!detail) {
            throw new AppError("Dokumentasi bangunan tidak ditemukan", 404);
        }

        const folderId = await resolveDokumentasiFolderId(detail.dokumentasi);
        const pdfBuffer = await buildDokumentasiBangunanPdfBuffer(detail);
        const kodeToko = sanitizeFilenamePart(detail.dokumentasi.kode_toko ?? undefined, "TOKO");
        const nomorUlok = sanitizeFilenamePart(detail.dokumentasi.nomor_ulok ?? undefined, "ULOK");
        const filename = `DOKUMENTASI_BANGUNAN_${kodeToko}_${nomorUlok}_${detail.dokumentasi.id}.pdf`;

        const linkPdf = await uploadPdfToDrive(folderId, pdfBuffer, filename);
        await dokumentasiBangunanRepository.updatePdfLink(detail.dokumentasi.id, linkPdf);

        return {
            dokumentasi: {
                ...detail.dokumentasi,
                link_pdf: linkPdf
            },
            items,
            pdf: {
                link_pdf: linkPdf,
                filename,
                item_count: detail.items.length
            }
        };
    },

    async list(query: DokumentasiBangunanListQueryInput) {
        return dokumentasiBangunanRepository.list(query);
    },

    async getDetail(id: number): Promise<DokumentasiBangunanDetail> {
        const detail = await dokumentasiBangunanRepository.getDetail(id);
        if (!detail) {
            throw new AppError("Dokumentasi bangunan tidak ditemukan", 404);
        }

        return detail;
    },

    async update(id: number, input: DokumentasiBangunanUpdateInput, files: UploadedDokumentasiFile[]) {
        const updated = await dokumentasiBangunanRepository.update(id, input);
        if (!updated) {
            throw new AppError("Dokumentasi bangunan tidak ditemukan", 404);
        }

        const newItems = await uploadFotoItemsBulk(updated, files);

        return {
            dokumentasi: updated,
            items: newItems
        };
    },

    async addItems(id: number, files: UploadedDokumentasiFile[]) {
        const dokumentasi = await dokumentasiBangunanRepository.findById(id);
        if (!dokumentasi) {
            throw new AppError("Dokumentasi bangunan tidak ditemukan", 404);
        }

        const items = await uploadFotoItemsBulk(dokumentasi, files);
        return { dokumentasi, items };
    },

    async delete(id: number) {
        const detail = await dokumentasiBangunanRepository.getDetail(id);
        if (!detail) {
            throw new AppError("Dokumentasi bangunan tidak ditemukan", 404);
        }

        const gp = GoogleProvider.instance;
        for (const item of detail.items) {
            const fileId = extractDriveFileId(item.link_foto);
            if (fileId) {
                await gp.deleteDriveFile(fileId);
            }
        }

        await dokumentasiBangunanRepository.delete(id);
        return { ok: true };
    },

    async deleteItem(itemId: number) {
        const item = await dokumentasiBangunanRepository.deleteItem(itemId);
        if (!item) {
            throw new AppError("Item dokumentasi tidak ditemukan", 404);
        }

        const gp = GoogleProvider.instance;
        const fileId = extractDriveFileId(item.link_foto);
        if (fileId) {
            await gp.deleteDriveFile(fileId);
        }

        return item;
    },

    async createPdf(id: number) {
        const detail = await dokumentasiBangunanRepository.getDetail(id);
        if (!detail) {
            throw new AppError("Dokumentasi bangunan tidak ditemukan", 404);
        }

        const folderId = await resolveDokumentasiFolderId(detail.dokumentasi);
        const pdfBuffer = await buildDokumentasiBangunanPdfBuffer(detail);
        const kodeToko = sanitizeFilenamePart(detail.dokumentasi.kode_toko ?? undefined, "TOKO");
        const nomorUlok = sanitizeFilenamePart(detail.dokumentasi.nomor_ulok ?? undefined, "ULOK");
        const filename = `DOKUMENTASI_BANGUNAN_${kodeToko}_${nomorUlok}_${detail.dokumentasi.id}.pdf`;

        const linkPdf = await uploadPdfToDrive(folderId, pdfBuffer, filename);
        await dokumentasiBangunanRepository.updatePdfLink(id, linkPdf);

        return {
            id: detail.dokumentasi.id,
            link_pdf: linkPdf,
            filename,
            item_count: detail.items.length
        };
    }
};
