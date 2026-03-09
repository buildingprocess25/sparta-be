import { AppError } from "../../common/app-error";
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

export const spkService = {
    async submit(payload: SubmitSpkInput) {
        const toko = await tokoRepository.findByNomorUlok(payload.nomor_ulok);
        if (!toko) {
            throw new AppError("Nomor ULOK tidak ditemukan di master toko", 404);
        }

        const isDuplicate = await spkRepository.existsActiveByUlokAndLingkup(
            payload.nomor_ulok,
            payload.lingkup_pekerjaan
        );

        if (isDuplicate) {
            throw new AppError(
                `SPK aktif untuk ULOK ${payload.nomor_ulok} dengan lingkup ${payload.lingkup_pekerjaan} sudah ada`,
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

        return spkRepository.create({
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
        });
    },

    async list(query: SpkListQuery) {
        return spkRepository.list(query);
    },

    async getById(id: string) {
        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }
        return data;
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

        const toko = await tokoRepository.findByNomorUlok(data.pengajuan.nomor_ulok);
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
