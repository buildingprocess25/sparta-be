import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { tokoRepository } from "../toko/toko.repository";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { RAB_STATUS, type RabStatus } from "./rab.constants";
import { buildRabPdfBuffer, buildRecapPdfBuffer, mergePdfBuffers, generateSphPdf } from "./rab.pdf";
import { rabRepository } from "./rab.repository";
import type { DetailItemInput, RabListQuery, SubmitRabInput } from "./rab.schema";

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

const driveDirectLink = (fileId: string): string => {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
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

    if (!result.id) return result.webViewLink ?? null;
    return driveDirectLink(result.id);
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

    pdfBuffersToMerge.push(pdfNonSbo, pdfRecap);

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
    async submit(payload: SubmitRabInput) {
        // 1. Cek duplikasi RAB aktif untuk nomor_ulok ini
        const existingToko = await tokoRepository.findByNomorUlok(payload.nomor_ulok);
        if (existingToko) {
            const isDuplicate = await rabRepository.existsActiveByTokoId(existingToko.id);
            if (isDuplicate) {
                throw new AppError(
                    `RAB aktif untuk ULOK ${payload.nomor_ulok} sudah ada`,
                    409
                );
            }
        }

        // 2. Hitung totals
        const totals = computeTotals(payload.detail_items);

        // 3. Simpan ke DB (upsert toko + insert rab + insert rab_item dalam 1 transaksi)
        let logoLink = payload.logo;
        if (payload.logo) {
            try {
                const filename = `RAB_LOGO_${payload.proyek ?? "PROYEK"}_${payload.nomor_ulok}.png`;
                const uploadedLink = await uploadLogoToDrive(payload.logo, filename);
                if (uploadedLink) {
                    logoLink = uploadedLink;
                }
            } catch (err) {
                console.error("Warning: Gagal upload logo RAB ke Drive:", err);
            }
        }

        const rab = await rabRepository.createWithDetails({
            // toko fields
            nomor_ulok: payload.nomor_ulok,
            lingkup_pekerjaan: payload.lingkup_pekerjaan,
            nama_toko: payload.nama_toko,
            kode_toko: payload.kode_toko,
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
        });

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

        return rab;
    },

    async list(query: RabListQuery) {
        return rabRepository.list(query);
    },

    async getById(id: string) {
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }
        return data;
    },

    async handleApproval(id: string, action: ApprovalActionInput) {
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const newStatus = resolveStatusTransition(data.rab.status, action);

        await rabRepository.updateApproval(id, newStatus, action);

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
            }
        }

        return {
            id,
            old_status: data.rab.status,
            new_status: newStatus
        };
    },

    async generatePdf(id: string) {
        const data = await rabRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan RAB tidak ditemukan", 404);
        }

        const pdfBuffer = await buildRabPdfBuffer({
            rab: data.rab,
            items: data.items,
            toko: data.toko
        });

        const filename = `RAB_${data.toko.nomor_ulok}_${data.rab.id}.pdf`;
        return { filename, pdfBuffer };
    }
};
