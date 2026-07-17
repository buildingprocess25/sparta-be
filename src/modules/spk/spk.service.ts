import { AppError } from "../../common/app-error";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { opnameFinalService } from "../opname-final/opname-final.service";
import { tokoRepository } from "../toko/toko.repository";
import { SPK_STATUS, getCabangCode } from "./spk.constants";
import { buildSpkPdfBuffer } from "./spk.pdf";
import { spkRepository } from "./spk.repository";
import type { SpkApprovalInput, SpkInterventionInput, SpkListQuery, SubmitSpkInput } from "./spk.schema";

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

const normalizeText = (value?: string | null): string => String(value ?? "").trim().toUpperCase();

const numericCurrencyValue = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    const trimmed = String(value).trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

    const numeric = Number(trimmed.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numeric) ? numeric : 0;
};

const roundSpkGrandTotal = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value / 1000) * 1000;
};

const isNoPpnArea = (toko: { cabang?: string | null; nama_toko?: string | null; alamat?: string | null }): boolean => {
    const identity = [
        toko.cabang,
        toko.nama_toko,
        toko.alamat,
    ].map(normalizeText);

    return identity.some(value => value === "BATAM" || value === "BINTAN" || /\bBATAM\b|\bBINTAN\b/.test(value));
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
        // Validasi tambahan untuk kode toko
        const kodeToko = payload.kode_toko?.trim().toUpperCase();
        if (!kodeToko || kodeToko.length !== 4) {
            throw new AppError("Kode toko wajib diisi tepat 4 karakter alfanumerik", 400);
        }
        if (!/^[A-Z0-9]{4}$/.test(kodeToko)) {
            throw new AppError("Kode toko harus 4 karakter alfanumerik (huruf dan angka), contoh: T123, AB12, 1A2B", 400);
        }

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
            kodeToko
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

        const approvedRabTotals = await spkRepository.findApprovedRabTotalsByTokoId(payload.id_toko);
        const rawSpkGrandTotal = isNoPpnArea(toko)
            ? numericCurrencyValue(approvedRabTotals?.grand_total_non_sbo)
                || numericCurrencyValue(approvedRabTotals?.grand_total)
                || numericCurrencyValue(approvedRabTotals?.grand_total_final)
                || payload.grand_total
            : numericCurrencyValue(approvedRabTotals?.grand_total_final)
                || numericCurrencyValue(approvedRabTotals?.grand_total)
                || payload.grand_total;
        const spkGrandTotal = roundSpkGrandTotal(rawSpkGrandTotal);

        // Hitung terbilang
        const totalCost = Math.floor(spkGrandTotal);
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
            grand_total: spkGrandTotal,
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
            await opnameFinalService.refreshDendaByTokoId(data.pengajuan.id_toko);

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

    async intervene(id: string, action: SpkInterventionInput) {
        const role = action.actor_role.toUpperCase();
        const isAllowed = role.includes("SUPER HUMAN")
            || role.includes("STORE & BRANCH CONTROLLING");
        if (!isAllowed) {
            throw new AppError("Hanya Super Human atau Store & Branch Controlling Specialist yang dapat melakukan intervensi SPK", 403);
        }

        const data = await spkRepository.findById(id);
        if (!data) {
            throw new AppError("Pengajuan SPK tidak ditemukan", 404);
        }

        const currentStatus = data.pengajuan.status;
        const targetStatus = action.target_status;

        if (currentStatus === targetStatus) {
            throw new AppError(`Status SPK sudah ${targetStatus}`, 409);
        }

        await spkRepository.interveneStatusAndInsertLog(id, currentStatus, targetStatus, action);
        await opnameFinalService.refreshDendaByTokoId(data.pengajuan.id_toko);

        if (targetStatus === SPK_STATUS.SPK_APPROVED) {
            try {
                const linkPdf = await regenerateSpkPdfAndUpload(id, {
                    proyek: data.pengajuan.proyek,
                    nomorUlok: data.pengajuan.nomor_ulok
                });

                if (linkPdf) {
                    await spkRepository.updatePdfLink(id, linkPdf);
                }
            } catch (err) {
                console.error("Warning: Gagal regenerate PDF SPK setelah intervensi:", err);
            }
        }

        return {
            id,
            old_status: currentStatus,
            new_status: targetStatus
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
