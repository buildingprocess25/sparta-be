import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { tokoRepository } from "../toko/toko.repository";
import type { ApprovalActionInput } from "../approval/approval.schema";
import { RAB_STATUS, type RabStatus } from "./rab.constants";
import { buildRabPdfBuffer, buildRecapPdfBuffer } from "./rab.pdf";
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

        if (currentStatus !== RAB_STATUS.APPROVED) {
            throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk approval direktur`, 409);
        }
        return RAB_STATUS.APPROVED;
    }

    // REJECT
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

    if (currentStatus !== RAB_STATUS.APPROVED) {
        throw new AppError(`Status saat ini "${currentStatus}" tidak valid untuk reject direktur`, 409);
    }
    return RAB_STATUS.REJECTED_BY_DIREKTUR;
};

/** Upload buffer ke Google Drive, return web view link */
async function uploadPdfToDrive(buffer: Buffer, filename: string): Promise<string> {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive ?? gp.docDrive;
    if (!drive) throw new AppError("Google Drive belum terkonfigurasi", 500);

    const result = await gp.uploadFile(
        env.PDF_STORAGE_FOLDER_ID,
        filename,
        "application/pdf",
        buffer
    );

    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const rabService = {
    async submit(payload: SubmitRabInput) {
        // 1. Cari toko by nomor_ulok
        const toko = await tokoRepository.findByNomorUlok(payload.nomor_ulok);
        if (!toko) {
            throw new AppError("Nomor ULOK tidak ditemukan di master toko", 404);
        }

        // 2. Cek duplikasi RAB aktif untuk toko ini
        const isDuplicate = await rabRepository.existsActiveByTokoId(toko.id);
        if (isDuplicate) {
            throw new AppError(
                `RAB aktif untuk ULOK ${payload.nomor_ulok} sudah ada`,
                409
            );
        }

        // 3. Hitung totals
        const totals = computeTotals(payload.detail_items);

        // 4. Simpan ke DB
        const rab = await rabRepository.createWithDetails({
            id_toko: toko.id,
            email_pembuat: payload.email_pembuat,
            nama_pt: payload.nama_pt,
            status: RAB_STATUS.WAITING_FOR_COORDINATOR,
            logo: payload.logo,
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

        // 5. Generate & upload 3 PDF ke Drive (sama seperti server Python)
        try {
            const proyek = toko.proyek ?? "N/A";
            const nomorUlok = toko.nomor_ulok;

            // Ambil items dari DB biar ada total_material, total_upah, total_harga
            const fullData = await rabRepository.findById(String(rab.id));
            if (fullData) {
                const pdfNonSbo = await buildRabPdfBuffer({
                    rab: fullData.rab,
                    items: fullData.items.filter(
                        (i) => i.kategori_pekerjaan.trim().toUpperCase() !== "PEKERJAAN SBO"
                    ),
                    toko: fullData.toko
                });

                const pdfRecap = await buildRecapPdfBuffer({
                    rab: fullData.rab,
                    items: fullData.items,
                    toko: fullData.toko
                });

                // Merged = non-sbo + recap concatenated
                const pdfMerged = Buffer.concat([pdfNonSbo, pdfRecap]);

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

                await rabRepository.updatePdfLinks(String(rab.id), {
                    link_pdf_gabungan: linkMerged,
                    link_pdf_non_sbo: linkNonSbo,
                    link_pdf_rekapitulasi: linkRecap
                });

                rab.link_pdf_gabungan = linkMerged;
                rab.link_pdf_non_sbo = linkNonSbo;
                rab.link_pdf_rekapitulasi = linkRecap;
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
