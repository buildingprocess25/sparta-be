import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { tokoRepository } from "../toko/toko.repository";
import { SPK_STATUS, getCabangCode } from "./spk.constants";
import { buildSpkPdfBuffer } from "./spk.pdf";
import { spkRepository } from "./spk.repository";
import type { SpkApprovalInput, SpkListQuery, SubmitSpkInput } from "./spk.schema";

const terbilang = (angka: number): string => {
    const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

    if (angka < 0) return "Minus " + terbilang(-angka);
    if (angka < 12) return satuan[angka];
    if (angka < 20) return satuan[angka - 10] + " Belas";
    if (angka < 100) return satuan[Math.floor(angka / 10)] + " Puluh" + (angka % 10 ? " " + satuan[angka % 10] : "");
    if (angka < 200) return "Seratus" + (angka - 100 ? " " + terbilang(angka - 100) : "");
    if (angka < 1000) return satuan[Math.floor(angka / 100)] + " Ratus" + (angka % 100 ? " " + terbilang(angka % 100) : "");
    if (angka < 2000) return "Seribu" + (angka - 1000 ? " " + terbilang(angka - 1000) : "");
    if (angka < 1_000_000) return terbilang(Math.floor(angka / 1000)) + " Ribu" + (angka % 1000 ? " " + terbilang(angka % 1000) : "");
    if (angka < 1_000_000_000) return terbilang(Math.floor(angka / 1_000_000)) + " Juta" + (angka % 1_000_000 ? " " + terbilang(angka % 1_000_000) : "");
    if (angka < 1_000_000_000_000) return terbilang(Math.floor(angka / 1_000_000_000)) + " Miliar" + (angka % 1_000_000_000 ? " " + terbilang(angka % 1_000_000_000) : "");
    return terbilang(Math.floor(angka / 1_000_000_000_000)) + " Triliun" + (angka % 1_000_000_000_000 ? " " + terbilang(angka % 1_000_000_000_000) : "");
};

async function uploadPdfToDrive(buffer: Buffer, filename: string): Promise<string> {
    const gp = GoogleProvider.instance;
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

async function regenerateSpkPdfAndUpload(
    pengajuanSpkId: string,
    filenameParts?: { proyek?: string | null; nomorUlok?: string | null }
): Promise<string | null> {
    const data = await spkRepository.findById(pengajuanSpkId);
    if (!data) return null;

    const toko = await tokoRepository.findById(data.pengajuan.id_toko);
    if (!toko) return null;

    const pdfBuffer = await buildSpkPdfBuffer({
        pengajuan: data.pengajuan,
        tokoNama: toko.nama_toko,
        tokoKode: toko.kode_toko,
        tokoAlamat: toko.alamat,
        tokoCabang: toko.cabang
    });

    const proyek = filenameParts?.proyek ?? data.pengajuan.proyek ?? "N/A";
    const nomorUlok = filenameParts?.nomorUlok ?? data.pengajuan.nomor_ulok ?? "UNKNOWN";
    const filename = `SPK_${proyek}_${nomorUlok}.pdf`;

    return uploadPdfToDrive(pdfBuffer, filename);
}

export const spkService = {
    async submit(payload: SubmitSpkInput) {
        const existingToko = await tokoRepository.findById(payload.id_toko);
        if (!existingToko) {
            throw new AppError("id_toko tidak ditemukan di master toko", 404);
        }

        if (existingToko.nomor_ulok !== payload.nomor_ulok) {
            throw new AppError("id_toko tidak cocok dengan nomor_ulok", 409);
        }

        const toko = await tokoRepository.updateKodeTokoByUlokAndLingkup(
            payload.nomor_ulok,
            payload.lingkup_pekerjaan,
            payload.kode_toko
        );

        if (!toko || toko.id !== payload.id_toko) {
            throw new AppError(
                `Data toko untuk ULOK ${payload.nomor_ulok} dengan lingkup ${payload.lingkup_pekerjaan} tidak cocok`,
                409
            );
        }

        const existingSpkByToko = await spkRepository.findLatestByTokoId(payload.id_toko);
        if (existingSpkByToko && existingSpkByToko.status !== SPK_STATUS.SPK_REJECTED) {
            throw new AppError(
                `SPK untuk toko dengan id_toko ${payload.id_toko} sudah ada`,
                409
            );
        }

        // Hitung waktu selesai
        const startDate = new Date(payload.waktu_mulai);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + payload.durasi - 1);
        const waktuSelesai = endDate.toISOString();

        // Hitung terbilang
        const totalCost = Math.floor(payload.grand_total);
        const terbilangText = `( ${terbilang(totalCost)} Rupiah )`;

        // Generate nomor SPK
        const now = new Date();
        const cabangCode = getCabangCode(toko.cabang);
        const sequence = await spkRepository.getNextSequence(toko.cabang, now.getFullYear(), now.getMonth() + 1);
        const nomorSpk = `${String(sequence).padStart(3, "0")}/PROPNDEV-${cabangCode}/${payload.spk_manual_1}/${payload.spk_manual_2}`;

        const submitPayload = {
            id_toko: payload.id_toko,
            nomor_ulok: payload.nomor_ulok,
            email_pembuat: payload.email_pembuat,
            lingkup_pekerjaan: payload.lingkup_pekerjaan,
            nama_kontraktor: payload.nama_kontraktor,
            proyek: payload.proyek,
            waktu_mulai: payload.waktu_mulai,
            durasi: payload.durasi,
            waktu_selesai: waktuSelesai,
            grand_total: payload.grand_total,
            terbilang: terbilangText,
            nomor_spk: nomorSpk,
            par: payload.par,
            spk_manual_1: payload.spk_manual_1,
            spk_manual_2: payload.spk_manual_2,
            status: SPK_STATUS.WAITING_FOR_BM_APPROVAL
        };

        const created = existingSpkByToko?.status === SPK_STATUS.SPK_REJECTED
            ? await spkRepository.resubmitRejected(String(existingSpkByToko.id), submitPayload)
            : await spkRepository.create(submitPayload);

        try {
            const linkPdf = await regenerateSpkPdfAndUpload(String(created.id), {
                proyek: payload.proyek,
                nomorUlok: payload.nomor_ulok
            });

            if (linkPdf) {
                await spkRepository.updatePdfLink(String(created.id), linkPdf);
                created.link_pdf = linkPdf;
            }
        } catch (err) {
            console.error("Warning: Gagal upload PDF SPK ke Drive:", err);
        }

        return created;
    },

    async list(query: SpkListQuery) {
        return spkRepository.list(query);
    },

    async getById(id: string) {
        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const toko = await tokoRepository.findById(data.pengajuan.id_toko);

        return {
            ...data,
            pengajuan: {
                ...data.pengajuan,
                toko: {
                    id: toko?.id ?? null,
                    nomor_ulok: toko?.nomor_ulok ?? data.pengajuan.nomor_ulok,
                    kode_toko: toko?.kode_toko ?? null,
                    nama_toko: toko?.nama_toko ?? null,
                    cabang: toko?.cabang ?? null,
                    alamat: toko?.alamat ?? null
                }
            }
        };
    },

    async handleApproval(id: string, action: SpkApprovalInput) {
        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const currentStatus = data.pengajuan.status;

        if (currentStatus !== SPK_STATUS.WAITING_FOR_BM_APPROVAL) {
            throw new AppError(
                `Tindakan sudah diproses. Status saat ini: ${currentStatus}`,
                409
            );
        }

        const newStatus = action.tindakan === "APPROVE"
            ? SPK_STATUS.SPK_APPROVED
            : SPK_STATUS.SPK_REJECTED;

        await spkRepository.updateStatusAndInsertLog(id, newStatus, action);

        if (action.tindakan === "APPROVE") {
            try {
                const linkPdf = await regenerateSpkPdfAndUpload(id, {
                    proyek: data.pengajuan.proyek,
                    nomorUlok: data.pengajuan.nomor_ulok
                });

                if (linkPdf) {
                    await spkRepository.updatePdfLink(id, linkPdf);
                }
            } catch (err) {
                console.error("Warning: Gagal regenerate PDF SPK setelah approval:", err);
            }
        }

        return {
            id,
            old_status: currentStatus,
            new_status: newStatus
        };
    },

    async generatePdf(id: string) {
        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const toko = await tokoRepository.findById(data.pengajuan.id_toko);
        if (!toko) {
            throw new AppError("Data toko tidak ditemukan", 404);
        }

        const pdfBuffer = await buildSpkPdfBuffer({
            pengajuan: data.pengajuan,
            tokoNama: toko.nama_toko,
            tokoKode: toko.kode_toko,
            tokoAlamat: toko.alamat,
            tokoCabang: toko.cabang
        });

        const filename = `SPK_${data.pengajuan.proyek}_${data.pengajuan.nomor_ulok}.pdf`;
        return { filename, pdfBuffer };
    }
};
