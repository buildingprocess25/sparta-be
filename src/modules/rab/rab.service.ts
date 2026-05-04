import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { tokoRepository } from "../toko/toko.repository";
import { userCabangRepository } from "../user-cabang/user-cabang.repository";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { RAB_STATUS, REJECTED_RAB_STATUSES, type RabStatus } from "./rab.constants";
import { buildRabPdfBuffer, buildRecapPdfBuffer, mergePdfBuffers, generateSphPdf } from "./rab.pdf";
import { rabRepository } from "./rab.repository";
import type { DetailItemInput, RabListQuery, SubmitRabInput, UpdateRabStatusInput } from "./rab.schema";

interface UploadedFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
}

interface SubmitUploadedFiles {
    insuranceFile?: UploadedFile;
    revInsuranceFile?: UploadedFile;
    revLogoFile?: UploadedFile;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const logRab = (stage: string, message: string, meta?: Record<string, unknown>): void => {
    if (meta) {
        console.log(`[RAB][${stage}] ${message}`, meta);
        return;
    }
    console.log(`[RAB][${stage}] ${message}`);
};

const roundCurrency = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value);
};

const computeTotals = (detailItems: DetailItemInput[]) => {
    let grandTotal = 0;
    let totalNonSbo = 0;

    for (const item of detailItems) {
        const totalItem = roundCurrency(item.volume * (item.harga_material + item.harga_upah));
        grandTotal += totalItem;

        if (item.kategori_pekerjaan.trim().toUpperCase() !== "PEKERJAAN SBO") {
            totalNonSbo += totalItem;
        }
    }

    const roundedDown = Math.floor(grandTotal / 10000) * 10000;
    const finalGrandTotal = roundCurrency(roundedDown + roundedDown * 0.11);

    return {
        grandTotal,
        totalNonSbo,
        finalGrandTotal
    };
};

// ---------------------------------------------------------------------------
// Branch detection helpers
// ---------------------------------------------------------------------------

/** MANADO: tidak ada koordinator, langsung Direktur → Manajer */
const isManadoBranch = (cabang?: string | null): boolean => {
    const normalized = String(cabang ?? "").trim().toUpperCase();
    return normalized === "MANADO";
};

/** BATAM/BINTAN: tidak ada manajer, langsung Direktur → Koordinator */
const isBatamBranch = (cabang?: string | null): boolean => {
    const normalized = String(cabang ?? "").trim().toUpperCase();
    return normalized === "BATAM" || normalized === "BINTAN";
};

const resolveStatusTransition = (
    currentStatus: RabStatus,
    action: ApprovalActionInput,
    cabang?: string | null
): RabStatus => {
    const manado = isManadoBranch(cabang);
    const batam = isBatamBranch(cabang);

    if (action.tindakan === "APPROVE") {
        if (action.jabatan === "DIREKTUR") {
            if (currentStatus !== RAB_STATUS.WAITING_FOR_DIREKTUR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval direktur`, 409);
            }
            // MANADO: skip koordinator → langsung ke manajer
            if (manado) return RAB_STATUS.WAITING_FOR_MANAGER;
            // Default & BATAM: ke koordinator
            return RAB_STATUS.WAITING_FOR_COORDINATOR;
        }

        if (action.jabatan === "KOORDINATOR") {
            if (currentStatus !== RAB_STATUS.WAITING_FOR_COORDINATOR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval koordinator`, 409);
            }
            // BATAM: tidak ada manajer → langsung approved
            if (batam) return RAB_STATUS.APPROVED;
            // Default: ke manajer
            return RAB_STATUS.WAITING_FOR_MANAGER;
        }

        if (action.jabatan === "MANAGER") {
            if (currentStatus !== RAB_STATUS.WAITING_FOR_MANAGER) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval manager`, 409);
            }
            return RAB_STATUS.APPROVED;
        }

        throw new AppError(`Jabatan "${action.jabatan}" tidak dikenali`, 400);
    }

    // REJECT
    if (action.jabatan === "DIREKTUR") {
        if (currentStatus !== RAB_STATUS.WAITING_FOR_DIREKTUR) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject direktur`, 409);
        }
        return RAB_STATUS.REJECTED_BY_DIREKTUR;
    }

    if (action.jabatan === "KOORDINATOR") {
        if (currentStatus !== RAB_STATUS.WAITING_FOR_COORDINATOR) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject koordinator`, 409);
        }
        return RAB_STATUS.REJECTED_BY_COORDINATOR;
    }

    if (action.jabatan === "MANAGER") {
        if (currentStatus !== RAB_STATUS.WAITING_FOR_MANAGER) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject manager`, 409);
        }
        return RAB_STATUS.REJECTED_BY_MANAGER;
    }

    throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject direktur`, 409);
};

const extractDriveFileId = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const byIdParam = /[?&]id=([^&]+)/.exec(trimmed);
    if (byIdParam?.[1]) return byIdParam[1];

    const byPath = /\/d\/([^/]+)/.exec(trimmed);
    if (byPath?.[1]) return byPath[1];

    return null;
};

const normalizeBase64Image = (value: string): { mimeType: string; buffer: Buffer } | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dataUriMatch = /^data:([\w/+.-]+);base64,(.+)$/i.exec(trimmed);
    if (dataUriMatch) {
        const [, mimeType, base64Data] = dataUriMatch;
        return { mimeType, buffer: Buffer.from(base64Data, "base64") };
    }

    const looksLikeBase64 = /^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 100;
    if (!looksLikeBase64) return null;

    return { mimeType: "image/png", buffer: Buffer.from(trimmed, "base64") };
};

const normalizeBase64Binary = (value: string): { mimeType: string; buffer: Buffer } | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dataUriMatch = /^data:([\w/+.-]+);base64,(.+)$/i.exec(trimmed);
    if (dataUriMatch) {
        const [, mimeType, base64Data] = dataUriMatch;
        return { mimeType, buffer: Buffer.from(base64Data, "base64") };
    }

    const looksLikeBase64 = /^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 100;
    if (!looksLikeBase64) return null;

    return { mimeType: "application/octet-stream", buffer: Buffer.from(trimmed, "base64") };
};

const driveDownloadLink = (fileId: string): string => {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const normalizeDriveDownloadLink = (value?: string | null): string | undefined => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return undefined;

    const fileId = extractDriveFileId(trimmed);
    if (!fileId) return trimmed;

    return driveDownloadLink(fileId);
};

const isPdfBuffer = (buffer: Buffer): boolean => {
    if (!buffer || buffer.length < 4) return false;
    return buffer.subarray(0, 4).toString() === "%PDF";
};

const fetchFileBufferByLink = async (
    rawLink: string,
): Promise<{ buffer: Buffer; mimeType?: string } | null> => {
    const trimmed = rawLink.trim();
    if (!trimmed) return null;

    const fileId = extractDriveFileId(trimmed);
    const gp = GoogleProvider.instance;

    if (fileId && gp.spartaDrive) {
        const buffer = await gp.getFileBufferById(gp.spartaDrive, fileId);
        if (buffer && buffer.length) {
            let mimeType: string | undefined;
            try {
                const meta = await gp.spartaDrive.files.get({ fileId, fields: "mimeType" });
                mimeType = meta.data.mimeType ?? undefined;
            } catch {
                // Best-effort metadata only.
            }

            return { buffer, mimeType };
        }
    }

    const downloadUrl = fileId
        ? driveDownloadLink(fileId)
        : normalizeDriveDownloadLink(trimmed) ?? trimmed;
    const response = await fetch(downloadUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return null;

    return {
        buffer,
        mimeType: response.headers.get("content-type") ?? undefined,
    };
};

const isRabAssetProxyPath = (value?: string | null): boolean => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return false;

    try {
        const parsed = new URL(trimmed, "http://local");
        return /^\/api\/rab\/\d+\/(logo|file-asuransi)$/i.test(parsed.pathname);
    } catch {
        return /^\/api\/rab\/\d+\/(logo|file-asuransi)$/i.test(trimmed);
    }
};

const normalizeIncomingAssetLink = (value?: string | null): string | undefined => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return undefined;
    if (isRabAssetProxyPath(trimmed)) return undefined;

    return normalizeDriveDownloadLink(trimmed);
};

const buildRabAssetDownloadPath = (
    rabId: number | string,
    assetField: "logo" | "file_asuransi",
    rawLink?: string | null,
): string | null => {
    const trimmed = (rawLink ?? "").trim();
    if (!trimmed) return null;

    if (assetField === "logo") {
        return `/api/rab/${rabId}/logo`;
    }

    return `/api/rab/${rabId}/file-asuransi`;
};

const normalizeRabFileLinks = <T extends { id: number | string; logo: string | null; file_asuransi: string | null }>(
    rab: T,
): T => {
    return {
        ...rab,
        logo: buildRabAssetDownloadPath(rab.id, "logo", rab.logo),
        file_asuransi: buildRabAssetDownloadPath(rab.id, "file_asuransi", rab.file_asuransi),
    };
};

const inferFileExtension = (mimeType?: string | null): string => {
    const value = (mimeType ?? "").toLowerCase();
    if (value === "application/pdf") return ".pdf";
    if (value === "image/png") return ".png";
    if (value === "image/jpeg") return ".jpg";
    if (value === "image/webp") return ".webp";
    if (value === "image/svg+xml") return ".svg";
    if (value === "application/zip") return ".zip";
    return "";
};

const uploadLogoToDrive = async (logoValue: string, filename: string): Promise<string | null> => {
    const normalized = normalizeBase64Image(logoValue);
    if (!normalized) return null;

    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        normalized.mimeType,
        normalized.buffer,
        2,
        drive,
    );

    if (!result.id) return normalizeDriveDownloadLink(result.webViewLink) ?? null;
    return driveDownloadLink(result.id);
};

const sanitizeFilenamePart = (value: string | undefined, fallback: string): string => {
    const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    return normalized || fallback;
};

const resolveFileExtension = (file: UploadedFile): string => {
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
    return ".bin";
};

const uploadInsuranceFileToDrive = async (
    file: UploadedFile,
    nomorUlok: string,
    proyek?: string,
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const safeProyek = sanitizeFilenamePart(proyek, "PROYEK");
    const safeUlok = sanitizeFilenamePart(nomorUlok, "ULOK");
    const ext = resolveFileExtension(file);
    const filename = `RAB_ASURANSI_${safeProyek}_${safeUlok}_${Date.now()}${ext}`;

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        file.mimetype || "application/octet-stream",
        file.buffer,
        2,
        drive,
    );

    if (!result.id) {
        if (result.webViewLink) return normalizeDriveDownloadLink(result.webViewLink) ?? result.webViewLink;
        throw new AppError("Upload file asuransi ke Google Drive gagal", 500);
    }

    return driveDownloadLink(result.id);
};

const uploadLogoFileToDrive = async (
    file: UploadedFile,
    nomorUlok: string,
    proyek?: string,
): Promise<string> => {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const safeProyek = sanitizeFilenamePart(proyek, "PROYEK");
    const safeUlok = sanitizeFilenamePart(nomorUlok, "ULOK");
    const ext = resolveFileExtension(file);
    const filename = `RAB_LOGO_${safeProyek}_${safeUlok}_${Date.now()}${ext}`;

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        file.mimetype || "application/octet-stream",
        file.buffer,
        2,
        drive,
    );

    if (!result.id) {
        if (result.webViewLink) return normalizeDriveDownloadLink(result.webViewLink) ?? result.webViewLink;
        throw new AppError("Upload logo ke Google Drive gagal", 500);
    }

    return driveDownloadLink(result.id);
};

const uploadInsuranceStringToDrive = async (
    fileValue: string,
    nomorUlok: string,
    proyek?: string,
): Promise<string> => {
    const normalized = normalizeBase64Binary(fileValue);
    if (!normalized) {
        return normalizeDriveDownloadLink(fileValue) ?? fileValue;
    }

    const ext = inferFileExtension(normalized.mimeType) || ".bin";
    const safeProyek = sanitizeFilenamePart(proyek, "PROYEK");
    const safeUlok = sanitizeFilenamePart(nomorUlok, "ULOK");
    const filename = `RAB_ASURANSI_${safeProyek}_${safeUlok}_${Date.now()}${ext}`;

    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        normalized.mimeType,
        normalized.buffer,
        2,
        drive,
    );

    if (!result.id) {
        if (result.webViewLink) return normalizeDriveDownloadLink(result.webViewLink) ?? result.webViewLink;
        throw new AppError("Upload file asuransi ke Google Drive gagal", 500);
    }

    return driveDownloadLink(result.id);
};

const resolveLogoForPdf = async (logoValue?: string | null): Promise<string | undefined> => {
    const trimmed = (logoValue ?? "").trim();
    if (!trimmed) return undefined;

    if (trimmed.startsWith("data:")) {
        return trimmed;
    }

    const fileId = extractDriveFileId(trimmed);
    if (!fileId) return trimmed;

    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) return trimmed;

    const buffer = await gp.getFileBufferById(drive, fileId);
    if (!buffer) return trimmed;

    let mimeType = "image/png";
    try {
        const meta = await drive.files.get({ fileId, fields: "mimeType" });
        if (meta.data.mimeType) {
            mimeType = meta.data.mimeType;
        }
    } catch {
        // Best-effort: fallback to PNG when metadata fetch fails.
    }

    return `data:${mimeType};base64,${buffer.toString("base64")}`;
};

/** Upload buffer ke Google Drive, return web view link */
async function uploadPdfToDrive(buffer: Buffer, filename: string): Promise<string> {
    const gp = GoogleProvider.instance;
    // Python server pakai drive_service (Sparta / token.json) utk upload RAB PDF
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        "application/pdf",
        buffer,
        2,
        drive,
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
}

async function regenerateRabPdfs(
    rabId: string,
    filenameParts: { proyek?: string | null; nomorUlok?: string | null },
    alamatCabangOverride?: string | null
): Promise<{
    link_pdf_gabungan: string;
    link_pdf_non_sbo: string;
    link_pdf_rekapitulasi: string;
    link_pdf_sph?: string;
} | null> {
    logRab("PDF", "Mulai regenerate PDF", { rabId });
    // Pastikan nomor SPH tersedia sejak awal submit dan tetap konsisten untuk regenerate berikutnya.
    const noSph = await rabRepository.ensureSphNumber(rabId);

    const fullData = await rabRepository.findById(rabId);
    if (!fullData) {
        logRab("PDF", "Data RAB tidak ditemukan saat regenerate", { rabId });
        return null;
    }
    fullData.rab.no_sph = noSph;

    const cabangKey = fullData.toko.cabang ?? "";
    const alamatCabangRow = alamatCabangOverride
        ? { alamat: alamatCabangOverride, cabang: cabangKey }
        : await tokoRepository.findAlamatCabangByCabang(cabangKey);
    const alamatCabang = alamatCabangRow?.alamat ?? null;

    const proyek = filenameParts.proyek ?? fullData.toko.proyek ?? "N/A";
    const nomorUlok = filenameParts.nomorUlok ?? fullData.toko.nomor_ulok ?? "UNKNOWN";

    const pdfNonSbo = await buildRabPdfBuffer({
        rab: fullData.rab,
        items: fullData.items,
        toko: fullData.toko
    });
    logRab("PDF", "PDF non SBO selesai dibuat", { rabId });

    const pdfRecap = await buildRecapPdfBuffer({
        rab: fullData.rab,
        items: fullData.items,
        toko: fullData.toko
    });
    logRab("PDF", "PDF rekap selesai dibuat", { rabId });

    const pdfBuffersToMerge: Buffer[] = [];
    let linkSph: string | undefined;
    const logoDataUri = await resolveLogoForPdf(fullData.rab.logo);

    const pdfSph = await generateSphPdf({
        rab: fullData.rab,
        items: fullData.items,
        toko: fullData.toko,
        logoOverride: logoDataUri,
        alamat_cabang: alamatCabang
    });
    pdfBuffersToMerge.push(pdfSph);
    logRab("PDF", "PDF SPH selesai dibuat", { rabId });

    linkSph = await uploadPdfToDrive(
        pdfSph,
        `SPH_${proyek}_${nomorUlok}.pdf`
    );
    logRab("PDF", "PDF SPH diupload", { rabId, linkSph });

    pdfBuffersToMerge.push(pdfRecap, pdfNonSbo);

    const insuranceLink = fullData.rab.file_asuransi?.trim();
    if (insuranceLink) {
        try {
            const insuranceFile = await fetchFileBufferByLink(insuranceLink);
            if (insuranceFile?.buffer?.length) {
                const isPdf = (insuranceFile.mimeType ?? "").toLowerCase() === "application/pdf"
                    || isPdfBuffer(insuranceFile.buffer);
                if (isPdf) {
                    pdfBuffersToMerge.push(insuranceFile.buffer);
                    logRab("PDF", "File asuransi PDF ditambahkan ke merge", { rabId });
                }
            }
        } catch (err) {
            console.error("Warning: Gagal mengambil file asuransi untuk merge PDF:", err);
        }
    }

    const pdfMerged = await mergePdfBuffers(pdfBuffersToMerge);

    const linkNonSbo = await uploadPdfToDrive(
        pdfNonSbo,
        `RAB_NON-SBO_${proyek}_${nomorUlok}.pdf`
    );
    const linkRecap = await uploadPdfToDrive(
        pdfRecap,
        `REKAP_RAB_${proyek}_${nomorUlok}.pdf`
    );
    const linkMerged = await uploadPdfToDrive(
        pdfMerged,
        `RAB_GABUNGAN_${proyek}_${nomorUlok}.pdf`
    );
    logRab("PDF", "PDF hasil generate selesai diupload", {
        rabId,
        linkMerged,
        linkNonSbo,
        linkRecap
    });

    return {
        link_pdf_gabungan: linkMerged,
        link_pdf_non_sbo: linkNonSbo,
        link_pdf_rekapitulasi: linkRecap,
        link_pdf_sph: linkSph
    };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const rabService = {
    async submit(payload: SubmitRabInput, uploadedFiles: SubmitUploadedFiles = {}) {
        logRab("SUBMIT", "Mulai submit RAB", {
            nomor_ulok: payload.nomor_ulok,
            lingkup_pekerjaan: payload.lingkup_pekerjaan,
            is_revisi: payload.is_revisi === true,
        });
        // 1. Tentukan mode submit: create baru atau revisi explicit dari frontend
        let rejectedRabToReplaceId: number | null = null;
        let rejectedRabExistingLogo: string | null = null;
        let rejectedRabExistingInsurance: string | null = null;
        const isRevisionSubmit = payload.is_revisi === true;
        const existingTokoByCombination = await tokoRepository.findByNomorUlokAndLingkup(
            payload.nomor_ulok,
            payload.lingkup_pekerjaan
        );

        if (isRevisionSubmit) {
            if (!payload.id_rab_revisi) {
                throw new AppError("Revisi RAB wajib mengirim id_rab_revisi", 400);
            }

            const targetRab = await rabRepository.findMinimalById(payload.id_rab_revisi);
            if (!targetRab) {
                throw new AppError("Data RAB revisi tidak ditemukan", 404);
            }

            if (!REJECTED_RAB_STATUSES.includes(targetRab.status)) {
                throw new AppError("RAB yang dipilih bukan status ditolak/revisi", 409);
            }

            if (!existingTokoByCombination) {
                throw new AppError(
                    `Data toko untuk kombinasi ULOK ${payload.nomor_ulok} dan lingkup ${payload.lingkup_pekerjaan ?? "-"} tidak ditemukan`,
                    404
                );
            }

            if (targetRab.id_toko !== existingTokoByCombination.id) {
                throw new AppError("id_rab_revisi tidak cocok dengan toko/lingkup yang dipilih", 409);
            }

            rejectedRabToReplaceId = targetRab.id;
            rejectedRabExistingLogo = targetRab.logo;
            rejectedRabExistingInsurance = targetRab.file_asuransi;
        } else if (existingTokoByCombination) {
            const alreadyExists = await rabRepository.existsAnyByTokoId(existingTokoByCombination.id);
            if (alreadyExists) {
                throw new AppError(
                    `RAB untuk kombinasi ULOK ${payload.nomor_ulok} dan lingkup ${payload.lingkup_pekerjaan ?? "-"} sudah ada`,
                    409
                );
            }
        }

        // 2. Hitung totals
        const totals = computeTotals(payload.detail_items);
        logRab("SUBMIT", "Totals dihitung", {
            grand_total: totals.grandTotal,
            grand_total_non_sbo: totals.totalNonSbo,
            grand_total_final: totals.finalGrandTotal,
        });

        // 3. Simpan ke DB (upsert toko + insert rab + insert rab_item dalam 1 transaksi)
        const logoInput = (payload.logo ?? "").trim();
        const revLogoInput = (payload.rev_logo ?? "").trim();
        const fileAsuransiInput = (payload.file_asuransi ?? "").trim();
        const revFileAsuransiInput = (payload.rev_file_asuransi ?? "").trim();

        const hasLogoInput = logoInput.length > 0 && !isRabAssetProxyPath(logoInput);
        const hasRevLogoInput = revLogoInput.length > 0 && !isRabAssetProxyPath(revLogoInput);
        const hasFileAsuransiInput = fileAsuransiInput.length > 0 && !isRabAssetProxyPath(fileAsuransiInput);
        const hasRevFileAsuransiInput = revFileAsuransiInput.length > 0 && !isRabAssetProxyPath(revFileAsuransiInput);
        const isRejectedResubmit = rejectedRabToReplaceId !== null;

        let logoLink = rejectedRabToReplaceId !== null
            ? normalizeIncomingAssetLink(rejectedRabExistingLogo)
            : undefined;

        if (!isRejectedResubmit && hasLogoInput) {
            const logoValue = logoInput;
            logoLink = normalizeIncomingAssetLink(logoValue);
            try {
                const filename = `RAB_LOGO_${payload.proyek ?? "PROYEK"}_${payload.nomor_ulok}.png`;
                const uploadedLink = await uploadLogoToDrive(logoValue, filename);
                if (uploadedLink) {
                    logoLink = uploadedLink;
                }
                logRab("SUBMIT", "Logo diupload", { logoLink });
            } catch (err) {
                console.error("Warning: Gagal upload logo RAB ke Drive:", err);
            }
        }

        if (isRejectedResubmit && hasRevLogoInput) {
            const revLogoValue = revLogoInput;
            let revLogoLink = normalizeIncomingAssetLink(revLogoValue);
            try {
                const filename = `RAB_LOGO_${payload.proyek ?? "PROYEK"}_${payload.nomor_ulok}_${Date.now()}.png`;
                const uploadedLink = await uploadLogoToDrive(revLogoValue, filename);
                if (uploadedLink) {
                    revLogoLink = uploadedLink;
                }
            } catch (err) {
                console.error("Warning: Gagal upload rev_logo RAB ke Drive:", err);
            }

            if (revLogoLink) {
                logoLink = revLogoLink;
            }
            logRab("SUBMIT", "Rev logo diupload", { logoLink });
        }

        if (isRejectedResubmit && uploadedFiles.revLogoFile) {
            logoLink = await uploadLogoFileToDrive(
                uploadedFiles.revLogoFile,
                payload.nomor_ulok,
                payload.proyek
            );
            logRab("SUBMIT", "Rev logo file diupload", { logoLink });
        }

        let insuranceLink = rejectedRabToReplaceId !== null
            ? normalizeIncomingAssetLink(rejectedRabExistingInsurance)
            : undefined;

        if (!isRejectedResubmit && hasFileAsuransiInput) {
            insuranceLink = normalizeIncomingAssetLink(fileAsuransiInput);
        }

        if (!isRejectedResubmit && uploadedFiles.insuranceFile) {
            insuranceLink = await uploadInsuranceFileToDrive(
                uploadedFiles.insuranceFile,
                payload.nomor_ulok,
                payload.proyek
            );
            logRab("SUBMIT", "File asuransi diupload", { insuranceLink });
        }

        if (isRejectedResubmit && hasRevFileAsuransiInput) {
            insuranceLink = await uploadInsuranceStringToDrive(
                revFileAsuransiInput,
                payload.nomor_ulok,
                payload.proyek
            );
            logRab("SUBMIT", "Rev file asuransi diupload", { insuranceLink });
        }

        if (isRejectedResubmit && uploadedFiles.revInsuranceFile) {
            insuranceLink = await uploadInsuranceFileToDrive(
                uploadedFiles.revInsuranceFile,
                payload.nomor_ulok,
                payload.proyek
            );
            logRab("SUBMIT", "Rev file asuransi (file) diupload", { insuranceLink });
        }

        const submitPayload = {
            // toko fields
            nomor_ulok: payload.nomor_ulok,
            lingkup_pekerjaan: payload.lingkup_pekerjaan,
            nama_toko: payload.nama_toko,
            proyek: payload.proyek,
            cabang: payload.cabang,
            alamat: payload.alamat,
            nama_kontraktor: payload.nama_kontraktor,
            // rab fields
            email_pembuat: payload.email_pembuat,
            nama_pt: payload.nama_pt,
            status: RAB_STATUS.WAITING_FOR_DIREKTUR,
            logo: logoLink,
            durasi_pekerjaan: payload.durasi_pekerjaan,
            kategori_lokasi: payload.kategori_lokasi,
            no_polis: payload.no_polis,
            berlaku_polis: payload.berlaku_polis,
            file_asuransi: insuranceLink,
            luas_bangunan: payload.luas_bangunan,
            luas_terbangun: payload.luas_terbangun,
            luas_area_terbuka: payload.luas_area_terbuka,
            luas_area_parkir: payload.luas_area_parkir,
            luas_area_sales: payload.luas_area_sales,
            luas_gudang: payload.luas_gudang,
            grand_total: String(totals.grandTotal),
            grand_total_non_sbo: String(totals.totalNonSbo),
            grand_total_final: String(totals.finalGrandTotal),
            detail_items: payload.detail_items
        };

        const rab = rejectedRabToReplaceId !== null
            ? await rabRepository.replaceRejectedWithDetails(rejectedRabToReplaceId, submitPayload)
            : await rabRepository.createWithDetails(submitPayload);
        logRab("SUBMIT", "RAB tersimpan di database", { rabId: rab.id });

        // 4. Generate & upload 3 PDF ke Drive (sama seperti server Python)
        try {
            const links = await regenerateRabPdfs(String(rab.id), {
                proyek: payload.proyek,
                nomorUlok: payload.nomor_ulok
            }, payload.alamat_cabang ?? null);

            if (links) {
                await rabRepository.updatePdfLinks(String(rab.id), links);
                rab.link_pdf_gabungan = links.link_pdf_gabungan;
                rab.link_pdf_non_sbo = links.link_pdf_non_sbo;
                rab.link_pdf_rekapitulasi = links.link_pdf_rekapitulasi;
                logRab("SUBMIT", "Link PDF tersimpan", {
                    rabId: rab.id,
                    link_pdf_gabungan: links.link_pdf_gabungan,
                    link_pdf_non_sbo: links.link_pdf_non_sbo,
                    link_pdf_rekapitulasi: links.link_pdf_rekapitulasi,
                });
            }
        } catch (err) {
            console.error("Warning: Gagal upload PDF ke Drive:", err);
        }

        return normalizeRabFileLinks(rab);
    },

    async list(query: RabListQuery) {
        const rows = await rabRepository.list(query);
        return rows.map((row) => normalizeRabFileLinks(row));
    },

    async getById(id: string) {
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }
        return {
            ...data,
            rab: normalizeRabFileLinks(data.rab),
        };
    },

    async handleApproval(id: string, action: ApprovalActionInput) {
        logRab("APPROVAL", "Mulai proses approval", {
            rabId: id,
            tindakan: action.tindakan,
            jabatan: action.jabatan,
            approver_email: action.approver_email,
        });
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const tokoStableFields = {
            kode_toko: data.toko.kode_toko,
            alamat: data.toko.alamat,
            nama_kontraktor: data.toko.nama_kontraktor,
        };

        const newStatus = resolveStatusTransition(data.rab.status, action, data.toko.cabang);
        if (action.tindakan === "REJECT") {
            await rabRepository.rejectRabAndActivateLatestGanttGuarded(
                id,
                newStatus,
                action.alasan_penolakan ?? "",
                action.approver_email
            );
            logRab("APPROVAL", "RAB ditolak", { rabId: id, newStatus });

            // Safety net: restore toko fields AFTER the transaction commits,
            // in case a deferred trigger or other side-effect corrupted them.
            await rabRepository.restoreTokoStableFieldsByRabId(id, tokoStableFields);
        } else {
            await rabRepository.updateApproval(id, newStatus, action);
            logRab("APPROVAL", "RAB diapprove", { rabId: id, newStatus });
        }

        if (action.tindakan === "APPROVE") {
            try {
                // Generate all PDFs together. If Direktur has approved, it will automatically include SPH.
                const links = await regenerateRabPdfs(id, {
                    proyek: data.toko.proyek,
                    nomorUlok: data.toko.nomor_ulok
                });

                if (links) {
                    await rabRepository.updatePdfLinks(id, {
                        link_pdf_gabungan: links.link_pdf_gabungan,
                        link_pdf_non_sbo: links.link_pdf_non_sbo,
                        link_pdf_rekapitulasi: links.link_pdf_rekapitulasi
                    });
                    
                    if (links.link_pdf_sph) {
                        await rabRepository.updateSphPdfLink(id, links.link_pdf_sph);
                    }
                    logRab("APPROVAL", "Link PDF diupdate setelah approval", {
                        rabId: id,
                        link_pdf_gabungan: links.link_pdf_gabungan,
                        link_pdf_non_sbo: links.link_pdf_non_sbo,
                        link_pdf_rekapitulasi: links.link_pdf_rekapitulasi,
                        link_pdf_sph: links.link_pdf_sph,
                    });
                }
            } catch (err) {
                console.error("Warning: Gagal regenerate PDF RAB setelah approval:", err);
            } finally {
                await rabRepository.restoreTokoStableFieldsByRabId(id, tokoStableFields);
            }
        }

        return {
            id,
            old_status: data.rab.status,
            new_status: newStatus
        };
    },

    async getPdfDownloadPayload(id: string) {
        logRab("DOWNLOAD", "Request PDF gabungan", { rabId: id });
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const rawLink = data.rab.link_pdf_gabungan?.trim();
        if (!rawLink) {
            throw new AppError("Link PDF gabungan belum tersedia", 404);
        }

        const filename = `RAB_GABUNGAN_${data.toko.nomor_ulok}_${data.rab.id}.pdf`;

        const fileId = extractDriveFileId(rawLink);
        const gp = GoogleProvider.instance;

        if (fileId && gp.spartaDrive) {
            const pdfBuffer = await gp.getFileBufferById(gp.spartaDrive, fileId);
            if (pdfBuffer) {
                logRab("DOWNLOAD", "PDF gabungan diambil dari Drive", { rabId: id });
                return { filename, pdfBuffer };
            }
        }

        const downloadUrl = fileId
            ? `https://drive.google.com/uc?export=download&id=${fileId}`
            : rawLink;

        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new AppError("Gagal mengambil file PDF gabungan", 502);
        }

        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        if (!pdfBuffer.length) {
            throw new AppError("File PDF gabungan kosong", 502);
        }
        logRab("DOWNLOAD", "PDF gabungan diambil via HTTP", { rabId: id });

        return { filename, pdfBuffer };
    },

    async getAssetDownloadPayload(id: string, assetField: "logo" | "file_asuransi") {
        logRab("DOWNLOAD", "Request asset", { rabId: id, assetField });
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const rawLink = (assetField === "logo" ? data.rab.logo : data.rab.file_asuransi)?.trim();
        if (!rawLink) {
            const label = assetField === "logo" ? "Logo" : "File asuransi";
            throw new AppError(`${label} tidak tersedia`, 404);
        }

        const fileId = extractDriveFileId(rawLink);
        const gp = GoogleProvider.instance;

        let fileBuffer: Buffer | null = null;
        let contentType: string | null = null;
        let filename: string | null = null;

        if (fileId && gp.spartaDrive) {
            fileBuffer = await gp.getFileBufferById(gp.spartaDrive, fileId);

            try {
                const meta = await gp.spartaDrive.files.get({ fileId, fields: "name,mimeType" });
                filename = meta.data.name ?? null;
                contentType = meta.data.mimeType ?? null;
            } catch {
                // best effort metadata only
            }
        }

        if (!fileBuffer) {
            const fallbackUrl = normalizeDriveDownloadLink(rawLink) ?? rawLink;
            const response = await fetch(fallbackUrl);
            if (!response.ok) {
                throw new AppError("Gagal mengambil file dari Google Drive", 502);
            }
            fileBuffer = Buffer.from(await response.arrayBuffer());
            contentType = response.headers.get("content-type") || contentType;
        }

        if (!fileBuffer.length) {
            throw new AppError("File kosong", 502);
        }
        logRab("DOWNLOAD", "Asset berhasil diambil", { rabId: id, assetField });

        const defaultPrefix = assetField === "logo" ? "RAB_LOGO" : "RAB_ASURANSI";
        const ext = inferFileExtension(contentType);
        const resolvedFilename = filename || `${defaultPrefix}_${data.toko.nomor_ulok}_${data.rab.id}${ext}`;

        return {
            filename: resolvedFilename,
            contentType: contentType || "application/octet-stream",
            fileBuffer,
        };
    },

    /**
     * Update status RAB berdasarkan id_rab.
     * Ketika status adalah "Ditolak" (salah satu status rejected):
     *  - Cari user di user_cabang berdasarkan cabang toko + jabatan yang sesuai
     *    (DIREKTUR / KOORDINATOR / MANAGER) → ambil emailnya
     *  - Insert email tersebut ke kolom ditolak_oleh di RAB
     *  - Set waktu_penolakan = sekarang
     *  - Update gantt_chart status → 'active' berdasarkan id_toko
     */
    async updateRabStatus(input: UpdateRabStatusInput) {
        const { id_toko, id_rab, status } = input;
        logRab("STATUS", "Mulai update status RAB", { id_rab, id_toko, status });

        // Validasi: RAB harus ada
        const rabData = await rabRepository.findById(String(id_rab));
        if (!rabData) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        // Validasi: id_toko harus cocok
        if (rabData.rab.id_toko !== id_toko) {
            throw new AppError("id_toko tidak cocok dengan RAB yang dipilih", 409);
        }

        // Tentukan apakah status termasuk penolakan
        const isRejection = REJECTED_RAB_STATUSES.includes(status as RabStatus);

        if (!isRejection) {
            throw new AppError(
                `Status "${status}" bukan status penolakan yang valid. Gunakan endpoint approval untuk approve.`,
                400
            );
        }

        // Tentukan jabatan penolak berdasarkan status yang dikirim
        let jabatanPenolak: string;
        if (status === RAB_STATUS.REJECTED_BY_DIREKTUR) {
            jabatanPenolak = "DIREKTUR";
        } else if (status === RAB_STATUS.REJECTED_BY_COORDINATOR) {
            jabatanPenolak = "BRANCH BUILDING COORDINATOR";
        } else if (status === RAB_STATUS.REJECTED_BY_MANAGER) {
            jabatanPenolak = "BRANCH BUILDING & MAINTENANCE MANAGER";
        } else {
            throw new AppError(`Status penolakan "${status}" tidak dikenali`, 400);
        }

        // Ambil cabang dari toko
        const cabang = rabData.toko.cabang;
        if (!cabang) {
            throw new AppError("Data cabang toko tidak ditemukan", 404);
        }

        // Cari user di user_cabang berdasarkan cabang + jabatan (dengan fallback legacy)
        const jabatanCandidates = jabatanPenolak === "BRANCH BUILDING COORDINATOR"
            ? ["BRANCH BUILDING COORDINATOR", "KOORDINATOR"]
            : jabatanPenolak === "BRANCH BUILDING & MAINTENANCE MANAGER"
                ? ["BRANCH BUILDING & MAINTENANCE MANAGER", "MANAGER"]
                : [jabatanPenolak];

        let userPenolak = null;
        let matchedJabatan = jabatanCandidates[0];
        for (const candidate of jabatanCandidates) {
            const found = await userCabangRepository.findByCabangAndJabatan(cabang, candidate);
            if (found) {
                userPenolak = found;
                matchedJabatan = candidate;
                break;
            }
        }
        if (!userPenolak) {
            throw new AppError(
                `User dengan jabatan "${jabatanPenolak}" untuk cabang "${cabang}" tidak ditemukan di data user cabang`,
                404
            );
        }

        const emailPenolak = userPenolak.email_sat;

        // Update RAB status + ditolak_oleh + waktu_penolakan + gantt → active
        await rabRepository.updateRabStatusWithRejection(
            id_rab,
            id_toko,
            status as RabStatus,
            emailPenolak
        );
        logRab("STATUS", "Update status RAB selesai", {
            id_rab,
            id_toko,
            status,
            ditolak_oleh: emailPenolak
        });

        return {
            id_rab,
            id_toko,
            old_status: rabData.rab.status,
            new_status: status,
            ditolak_oleh: emailPenolak,
            jabatan_penolak: matchedJabatan
        };
    }
};

