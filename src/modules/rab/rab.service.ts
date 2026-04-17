import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { tokoRepository } from "../toko/toko.repository";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { RAB_STATUS, REJECTED_RAB_STATUSES, type RabStatus } from "./rab.constants";
import { buildRabPdfBuffer, buildRecapPdfBuffer, mergePdfBuffers, generateSphPdf } from "./rab.pdf";
import { rabRepository } from "./rab.repository";
import type { DetailItemInput, RabListQuery, SubmitRabInput } from "./rab.schema";

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

const computeTotals = (detailItems: DetailItemInput[]) => {
    let grandTotal = 0;
    let totalNonSbo = 0;

    for (const item of detailItems) {
        const totalItem = item.volume * (item.harga_material + item.harga_upah);
        grandTotal += totalItem;

        if (item.kategori_pekerjaan.trim().toUpperCase() !== "PEKERJAAN SBO") {
            totalNonSbo += totalItem;
        }
    }

    const roundedDown = Math.floor(grandTotal / 10000) * 10000;
    const finalGrandTotal = roundedDown + roundedDown * 0.11;

    return {
        grandTotal,
        totalNonSbo,
        finalGrandTotal
    };
};

const resolveStatusTransition = (
    currentStatus: RabStatus,
    action: ApprovalActionInput
): RabStatus => {
    if (action.tindakan === "APPROVE") {
        if (action.jabatan === "DIREKTUR") {
            if (currentStatus !== RAB_STATUS.WAITING_FOR_DIREKTUR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval direktur`, 409);
            }
            return RAB_STATUS.WAITING_FOR_COORDINATOR;
        }

        if (action.jabatan === "KOORDINATOR") {
            if (currentStatus !== RAB_STATUS.WAITING_FOR_COORDINATOR) {
                throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval koordinator`, 409);
            }
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
    filenameParts: { proyek?: string | null; nomorUlok?: string | null }
): Promise<{
    link_pdf_gabungan: string;
    link_pdf_non_sbo: string;
    link_pdf_rekapitulasi: string;
    link_pdf_sph?: string;
} | null> {
    // Pastikan nomor SPH tersedia sejak awal submit dan tetap konsisten untuk regenerate berikutnya.
    const noSph = await rabRepository.ensureSphNumber(rabId);

    const fullData = await rabRepository.findById(rabId);
    if (!fullData) return null;
    fullData.rab.no_sph = noSph;

    const proyek = filenameParts.proyek ?? fullData.toko.proyek ?? "N/A";
    const nomorUlok = filenameParts.nomorUlok ?? fullData.toko.nomor_ulok ?? "UNKNOWN";

    const pdfNonSbo = await buildRabPdfBuffer({
        rab: fullData.rab,
        items: fullData.items,
        toko: fullData.toko
    });

    const pdfRecap = await buildRecapPdfBuffer({
        rab: fullData.rab,
        items: fullData.items,
        toko: fullData.toko
    });

    const pdfBuffersToMerge: Buffer[] = [];
    let linkSph: string | undefined;
    const logoDataUri = await resolveLogoForPdf(fullData.rab.logo);

    const pdfSph = await generateSphPdf({
        rab: fullData.rab,
        items: fullData.items,
        toko: fullData.toko,
        logoOverride: logoDataUri
    });
    pdfBuffersToMerge.push(pdfSph);

    linkSph = await uploadPdfToDrive(
        pdfSph,
        `SPH_${proyek}_${nomorUlok}.pdf`
    );

    pdfBuffersToMerge.push(pdfRecap, pdfNonSbo);

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
        // 1. Cek apakah ini submit baru atau resubmit dari data yang ditolak
        let rejectedRabToReplaceId: number | null = null;
        let rejectedRabExistingLogo: string | null = null;
        let rejectedRabExistingInsurance: string | null = null;
        const existingToko = await tokoRepository.findByNomorUlok(payload.nomor_ulok);
        if (existingToko) {
            const latestRab = await rabRepository.findLatestByTokoId(existingToko.id);

            if (latestRab && REJECTED_RAB_STATUSES.includes(latestRab.status)) {
                rejectedRabToReplaceId = latestRab.id;
                rejectedRabExistingLogo = latestRab.logo;
                rejectedRabExistingInsurance = latestRab.file_asuransi;
            } else {
                const isDuplicate = await rabRepository.existsActiveByTokoId(existingToko.id);
                if (isDuplicate) {
                    throw new AppError(
                        `RAB aktif untuk ULOK ${payload.nomor_ulok} sudah ada`,
                        409
                    );
                }
            }
        }

        // Validasi lingkup saat resubmit agar tidak salah menimpa data ULOK yang berbeda scope pekerjaan.
        if (existingToko && rejectedRabToReplaceId !== null) {
            const currentLingkup = (existingToko.lingkup_pekerjaan ?? "").trim().toLowerCase();
            const incomingLingkup = (payload.lingkup_pekerjaan ?? "").trim().toLowerCase();

            if (currentLingkup && incomingLingkup && currentLingkup !== incomingLingkup) {
                throw new AppError(
                    `Lingkup pekerjaan untuk ULOK ${payload.nomor_ulok} tidak sesuai dengan data reject sebelumnya`,
                    409
                );
            }
        }

        // 2. Hitung totals
        const totals = computeTotals(payload.detail_items);

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
        }

        if (isRejectedResubmit && uploadedFiles.revLogoFile) {
            logoLink = await uploadLogoFileToDrive(
                uploadedFiles.revLogoFile,
                payload.nomor_ulok,
                payload.proyek
            );
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
        }

        if (isRejectedResubmit && hasRevFileAsuransiInput) {
            insuranceLink = await uploadInsuranceStringToDrive(
                revFileAsuransiInput,
                payload.nomor_ulok,
                payload.proyek
            );
        }

        if (isRejectedResubmit && uploadedFiles.revInsuranceFile) {
            insuranceLink = await uploadInsuranceFileToDrive(
                uploadedFiles.revInsuranceFile,
                payload.nomor_ulok,
                payload.proyek
            );
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

        // 4. Generate & upload 3 PDF ke Drive (sama seperti server Python)
        try {
            const links = await regenerateRabPdfs(String(rab.id), {
                proyek: payload.proyek,
                nomorUlok: payload.nomor_ulok
            });

            if (links) {
                await rabRepository.updatePdfLinks(String(rab.id), links);
                rab.link_pdf_gabungan = links.link_pdf_gabungan;
                rab.link_pdf_non_sbo = links.link_pdf_non_sbo;
                rab.link_pdf_rekapitulasi = links.link_pdf_rekapitulasi;
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
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const tokoStableFields = {
            kode_toko: data.toko.kode_toko,
            alamat: data.toko.alamat,
            nama_kontraktor: data.toko.nama_kontraktor,
        };

        const newStatus = resolveStatusTransition(data.rab.status, action);
        if (action.tindakan === "REJECT") {
            await rabRepository.rejectRabAndActivateLatestGanttGuarded(
                id,
                newStatus,
                action.alasan_penolakan ?? "",
                action.approver_email
            );
        } else {
            await rabRepository.updateApproval(id, newStatus, action);
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

        return { filename, pdfBuffer };
    },

    async getAssetDownloadPayload(id: string, assetField: "logo" | "file_asuransi") {
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

        const defaultPrefix = assetField === "logo" ? "RAB_LOGO" : "RAB_ASURANSI";
        const ext = inferFileExtension(contentType);
        const resolvedFilename = filename || `${defaultPrefix}_${data.toko.nomor_ulok}_${data.rab.id}${ext}`;

        return {
            filename: resolvedFilename,
            contentType: contentType || "application/octet-stream",
            fileBuffer,
        };
    }
};
