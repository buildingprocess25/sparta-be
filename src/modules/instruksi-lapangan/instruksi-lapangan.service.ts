import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { AppError } from "../../common/app-error";
import { env } from "../../config/env";
import { GoogleProvider } from "../../common/google";
import type { ApprovalActionInput } from "../approval/approval.schema";
import type { ListInstruksiLapanganQuery, SubmitInstruksiLapanganInput } from "./instruksi-lapangan.schema";
import { instruksiLapanganRepository } from "./instruksi-lapangan.repository";
import {
    buildInstruksiLapanganPdfBuffer,
    buildInstruksiLapanganRecapPdfBuffer,
    mergePdfBuffers
} from "./instruksi-lapangan.pdf";

const MailComposer = require("nodemailer/lib/mail-composer");

const saveUploadToTemp = async (file: { originalname: string; buffer: Buffer }): Promise<string> => {
    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;
    const tmpPath = path.join(process.cwd(), "tmp", filename);
    
    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    await fs.writeFile(tmpPath, file.buffer);
    
    return tmpPath;
};

const extractDriveFileId = (value: string): string | null => {
    const match = value.match(/id=([^&]+)/) || value.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};



async function uploadPdfToDrive(buffer: Buffer, filename: string, nomorUlok?: string, proyek?: string): Promise<string> {
    const gp = GoogleProvider.instance;
    const drive = gp.spartaDrive;
    if (!drive) throw new AppError("Google Drive (Sparta) belum terkonfigurasi", 500);

    const folderId = await gp.getOrCreateProcessFolder("Instruksi Lapangan", nomorUlok);

    const result = await gp.uploadFile(
        folderId,
        filename,
        "application/pdf",
        buffer,
        2,
        drive,
    );
    return result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`;
}

const normalizeNoPpnText = (value?: string | null): string => String(value ?? "").trim().toUpperCase();

const isNoPpnArea = (toko: { cabang?: string | null; nama_toko?: string | null; alamat?: string | null }): boolean => {
    const identity = [
        toko.cabang,
        toko.nama_toko,
        toko.alamat,
    ].map(normalizeNoPpnText);

    return identity.some(value => value === "BATAM" || value === "BINTAN" || /\bBATAM\b|\bBINTAN\b/.test(value));
};

const toIsoDateOnly = (value?: string | null): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const [, dd, mm, yyyy] = slashMatch;
        return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
};

const formatDateId = (value?: string | null): string => {
    const iso = toIsoDateOnly(value);
    if (!iso) return "-";
    const [yyyy, mm, dd] = iso.split("-");
    return `${dd}/${mm}/${yyyy}`;
};

const generateInstruksiLapanganPdfInBackground = (idIL: number | string): void => {
    setImmediate(() => {
        instruksiLapanganService.regeneratePdfWithPair(idIL).catch((err) => {
            console.error("[IL][PDF_BACKGROUND] Gagal generate/upload PDF Instruksi Lapangan", {
                idIL,
                error: err instanceof Error ? err.message : String(err)
            });
        });
    });
};

const generateInstruksiLapanganPdfUnifiedInBackground = (idILs: number[]): void => {
    setImmediate(() => {
        instruksiLapanganService.generateAndStorePdfUnified(idILs).catch((err) => {
            console.error("[IL][PDF_BACKGROUND] Gagal generate/upload PDF Unified Instruksi Lapangan", {
                idILs,
                error: err instanceof Error ? err.message : String(err)
            });
        });
    });
};

async function sendILApprovalEmail(data: any, pdfBuffer: Buffer, pdfFilename: string) {
    if (!env.EMAIL_USER) {
        console.warn("[IL][EMAIL] EMAIL_USER belum diset, melewati pengiriman email.");
        return;
    }

    const gmail = GoogleProvider.instance.spartaGmail;
    if (!gmail) {
        console.warn("[IL][EMAIL] Google Gmail belum terkonfigurasi, melewati pengiriman email.");
        return;
    }

    const recipient = data.instruksiLapangan.email_pembuat;
    if (!recipient) {
        console.warn("[IL][EMAIL] Tidak ada email pembuat (kontraktor) untuk IL ini.");
        return;
    }

    const htmlBody = `
Yth. Bapak/Ibu Kontraktor,
<br><br>
Bersama email ini, kami informasikan bahwa pengajuan Instruksi Lapangan (IL) untuk proyek <b>${data.toko.nama_toko}</b> dengan Nomor ULOK <b>${data.toko.nomor_ulok}</b> telah <b>DISETUJUI</b> secara keseluruhan.
<br><br>
Sebagai acuan resmi pelaksanaan pekerjaan di lapangan, kami telah melampirkan dokumen PDF Instruksi Lapangan final bersama email ini.
<br><br>
Untuk melihat detail persetujuan dan rincian pekerjaan lebih lanjut, silakan akses portal resmi SPARTA melalui tautan berikut:<br>
<a href="https://building.sparta-alfamart.web.id/">https://building.sparta-alfamart.web.id/</a>
<br><br>
Demikian informasi ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.
<br><br>
Hormat kami,
<br><br>
<b>Tim SPARTA Alfamart</b>
<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
<span style="font-size: 12px; color: #666;">(Email ini dibuat secara otomatis oleh sistem, mohon untuk tidak membalas ke alamat email ini)</span>
    `;

    const options = {
        from: `"Tim SPARTA Alfamart" <${env.EMAIL_USER}>`,
        to: recipient,
        subject: `[DISETUJUI] Instruksi Lapangan (IL) Proyek ${data.toko.nama_toko} - ${data.toko.nomor_ulok}`,
        html: htmlBody,
        attachments: [
            {
                filename: pdfFilename,
                content: pdfBuffer,
            }
        ]
    };

    try {
        const mail = new MailComposer(options);
        const messageBuffer = await mail.compile().build();
        const encodedMessage = messageBuffer
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage },
        });
        console.log(`[IL][EMAIL] Email persetujuan IL berhasil dikirim ke ${recipient}`);
    } catch (err: any) {
        console.error(`[IL][EMAIL] Gagal mengirim email persetujuan IL ke ${recipient}:`, err?.message || err);
    }
}

export const instruksiLapanganService = {
    async submit(
        payload: SubmitInstruksiLapanganInput,
        files: { lampiranFile?: { originalname: string; buffer: Buffer; mimetype: string } }
    ) {
        const tokos = await instruksiLapanganRepository.getTokosByUlok(payload.nomor_ulok);
        if (tokos.length === 0) {
            throw new AppError(`Toko dengan nomor ULOK ${payload.nomor_ulok} tidak ditemukan`, 404);
        }

        const tanggalMulai = toIsoDateOnly(payload.tanggal_mulai);
        const tanggalSelesai = toIsoDateOnly(payload.tanggal_selesai);
        if (!tanggalMulai || !tanggalSelesai) {
            throw new AppError("Tanggal mulai dan tanggal selesai Instruksi Lapangan wajib valid", 400);
        }
        if (tanggalSelesai < tanggalMulai) {
            throw new AppError("Tanggal selesai Instruksi Lapangan tidak boleh sebelum tanggal mulai", 400);
        }

        let lampiranPath: string | undefined;
        if (files.lampiranFile) {
            lampiranPath = await saveUploadToTemp(files.lampiranFile);
        }

        // Pisahkan item berdasarkan lingkup pekerjaan
        const itemsByScope = new Map<string, any[]>();
        for (const item of payload.detail_items) {
            const scope = (item.lingkup_pekerjaan || payload.lingkup_pekerjaan || tokos[0].lingkup_pekerjaan).trim().toUpperCase();
            if (!itemsByScope.has(scope)) {
                itemsByScope.set(scope, []);
            }
            itemsByScope.get(scope)!.push(item);
        }

        const results: any[] = [];

        // Handle revisi (biasanya hanya satu scope yang direvisi, tapi kita support fallback)
        if (payload.id_instruksi_lapangan_revisi) {
            const existing = await instruksiLapanganRepository.getHeaderAndToko(payload.id_instruksi_lapangan_revisi);
            if (!existing) throw new AppError("Instruksi Lapangan revisi tidak ditemukan", 404);
            if (existing.instruksiLapangan.status.toUpperCase() !== "DITOLAK") {
                throw new AppError("Hanya Instruksi Lapangan berstatus Ditolak yang dapat direvisi", 409);
            }
            
            const scopeToko = tokos.find(t => t.id === existing.instruksiLapangan.id_toko) || tokos[0];
            const scopeItems = itemsByScope.get((scopeToko.lingkup_pekerjaan || "").trim().toUpperCase()) || payload.detail_items;
            
            const scopePayload = {
                ...payload,
                detail_items: scopeItems,
                lingkup_pekerjaan: scopeToko.lingkup_pekerjaan
            };

            const idInstruksiLapangan = await instruksiLapanganRepository.replaceRejectedWithDetails(
                existing.instruksiLapangan.id,
                scopePayload,
                lampiranPath
            );
            generateInstruksiLapanganPdfUnifiedInBackground([idInstruksiLapangan]);
            const resData = await instruksiLapanganRepository.getById(idInstruksiLapangan);
            return resData;
        }

        const idsToGenerate: number[] = [];

        // Pengajuan baru: iterasi untuk setiap lingkup yang ada itemnya
        for (const [scope, items] of itemsByScope.entries()) {
            let scopeToko = tokos.find(t => (t.lingkup_pekerjaan || "").trim().toUpperCase() === scope);
            if (!scopeToko) scopeToko = tokos[0]; // Fallback jika tidak match

            const dateBounds = await instruksiLapanganRepository.getDateBoundsByTokoId(scopeToko.id);
            if (!dateBounds?.spk_start_date || !dateBounds.max_allowed_date) {
                throw new AppError(`SPK approved untuk lingkup ${scopeToko.lingkup_pekerjaan} belum memiliki rentang tanggal yang valid`, 409);
            }
            if (tanggalMulai < dateBounds.spk_start_date) {
                throw new AppError(`Tanggal mulai Instruksi Lapangan tidak boleh sebelum tanggal mulai SPK (${formatDateId(dateBounds.spk_start_date)})`, 400);
            }
            if (tanggalSelesai > dateBounds.max_allowed_date) {
                throw new AppError(`Tanggal selesai Instruksi Lapangan tidak boleh melewati batas efektif SPK/ST (${formatDateId(dateBounds.max_allowed_date)})`, 400);
            }

            const scopePayload = {
                ...payload,
                detail_items: items,
                lingkup_pekerjaan: scopeToko.lingkup_pekerjaan
            };

            const idInstruksiLapangan = await instruksiLapanganRepository.insertWithItems(
                scopePayload,
                scopeToko.id,
                lampiranPath
            );

            console.log("[IL][SUBMIT_SERVICE] Data IL berhasil tersimpan", {
                id_instruksi_lapangan: idInstruksiLapangan,
                id_toko: scopeToko.id,
                lingkup: scopeToko.lingkup_pekerjaan
            });

            idsToGenerate.push(idInstruksiLapangan);
            const resData = await instruksiLapanganRepository.getById(idInstruksiLapangan);
            if (resData) results.push(resData);
        }

        if (idsToGenerate.length > 0) {
            generateInstruksiLapanganPdfUnifiedInBackground(idsToGenerate);
        }

        return results[0] || null;
    },

    async generateAndStorePdfUnified(idILs: number[]) {
        if (!idILs || idILs.length === 0) return;
        
        let primaryData = null;
        let allItems: any[] = [];
        let scopes: Set<string> = new Set();
        
        for (const id of idILs) {
            const data = await instruksiLapanganRepository.getHeaderAndToko(id);
            if (!data) continue;
            
            if (!primaryData) primaryData = data;
            
            const lingkup = data.toko.lingkup_pekerjaan?.trim().toUpperCase() || "";
            scopes.add(lingkup);
            
            const items = await instruksiLapanganRepository.getItems(id);
            const itemsWithScope = items.map(it => ({ ...it, lingkup_pekerjaan: lingkup }));
            allItems.push(...itemsWithScope);
        }
        
        console.log(`[IL][DEBUG] generateAndStorePdfUnified: allItems count = ${allItems.length}, items:`, allItems.map(i => i.id));
        
        if (!primaryData) return;
        
        const mergedToko = {
            ...primaryData.toko,
            lingkup_pekerjaan: scopes.size > 1 ? Array.from(scopes).join(" & ") : primaryData.toko.lingkup_pekerjaan
        };
        
        const noPpn = isNoPpnArea(mergedToko);
        
        const reportBuffer = await buildInstruksiLapanganPdfBuffer({
            instruksiLapangan: primaryData.instruksiLapangan,
            items: allItems,
            toko: mergedToko
        });

        const recapBuffer = await buildInstruksiLapanganRecapPdfBuffer({
            instruksiLapangan: primaryData.instruksiLapangan,
            items: allItems,
            toko: mergedToko
        });

        const buffersToMerge: Buffer[] = [recapBuffer, reportBuffer];

        if (primaryData.instruksiLapangan.link_lampiran) {
            try {
                const lampiranBuffer = await fs.readFile(primaryData.instruksiLapangan.link_lampiran);
                if (lampiranBuffer.subarray(0, 4).toString('hex') === '25504446') {
                    buffersToMerge.push(lampiranBuffer);
                }
            } catch (err) {
                console.warn("Could not read lampiran for merging", err);
            }
        }

        const mergedBuffer = await mergePdfBuffers(buffersToMerge);
        const pdfFilename = `Instruksi_Lapangan_${mergedToko.nomor_ulok}_${Date.now()}`;

        const [linkGabungan, linkNonSbo, linkRekap] = await Promise.all([
            uploadPdfToDrive(mergedBuffer, `${pdfFilename}_Gabungan.pdf`, mergedToko.nomor_ulok, mergedToko.proyek),
            uploadPdfToDrive(reportBuffer, `${pdfFilename}_NonSBO.pdf`, mergedToko.nomor_ulok, mergedToko.proyek),
            uploadPdfToDrive(recapBuffer, `${pdfFilename}_Rekapitulasi.pdf`, mergedToko.nomor_ulok, mergedToko.proyek)
        ]);

        const total = allItems.reduce((acc, item) => acc + Number(item.total_harga || 0), 0);
        const roundedDown = Math.floor(total / 10000) * 10000;
        const ppn = noPpn ? 0 : roundedDown * 0.11;
        const finalTotal = roundedDown + ppn;

        for (const id of idILs) {
            await instruksiLapanganRepository.updatePdfLinks(id, {
                pdfGabungan: linkGabungan || "",
                pdfNonSbo: linkNonSbo || "",
                pdfRekapitulasi: linkRekap || "",
                grandTotalNonSbo: total.toString(),
                grandTotalFinal: finalTotal.toString()
            });
        }
    },

    async regeneratePdfWithPair(idIL: number | string) {
        const id = Number(idIL);
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) return;

        const idILs = await instruksiLapanganRepository.getPairIds(data.toko.nomor_ulok, data.instruksiLapangan.status, data.instruksiLapangan.email_pembuat);
        
        console.log(`[IL][DEBUG] Regenerate for ID ${idIL}, found pairs:`, idILs);

        if (idILs.length > 0) {
            await this.generateAndStorePdfUnified(idILs);
        }
    },

    async generateAndStorePdf(idIL: number | string) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(idIL);
        if (!data) return;

        const items = await instruksiLapanganRepository.getItems(idIL);
        
        const noPpn = isNoPpnArea(data.toko);

        const reportBuffer = await buildInstruksiLapanganPdfBuffer({
            instruksiLapangan: data.instruksiLapangan,
            items,
            toko: data.toko
        });

        const recapBuffer = await buildInstruksiLapanganRecapPdfBuffer({
            instruksiLapangan: data.instruksiLapangan,
            items,
            toko: data.toko
        });

        const buffersToMerge: Buffer[] = [recapBuffer, reportBuffer];

        // Also merge lampiran if it's a PDF
        if (data.instruksiLapangan.link_lampiran) {
            try {
                const lampiranBuffer = await fs.readFile(data.instruksiLapangan.link_lampiran);
                // check if it's pdf magic number
                if (lampiranBuffer.subarray(0, 4).toString('hex') === '25504446') {
                    buffersToMerge.push(lampiranBuffer);
                }
            } catch (err) {
                console.warn("Could not read lampiran for merging", err);
            }
        }

        const mergedBuffer = await mergePdfBuffers(buffersToMerge);

        const pdfFilename = `Instruksi_Lapangan_${data.toko.nomor_ulok}_${Date.now()}`;

        const [linkGabungan, linkNonSbo, linkRekap] = await Promise.all([
            uploadPdfToDrive(mergedBuffer, `${pdfFilename}_Gabungan.pdf`, data.toko.nomor_ulok, data.toko.proyek),
            uploadPdfToDrive(reportBuffer, `${pdfFilename}_NonSBO.pdf`, data.toko.nomor_ulok, data.toko.proyek),
            uploadPdfToDrive(recapBuffer, `${pdfFilename}_Rekapitulasi.pdf`, data.toko.nomor_ulok, data.toko.proyek)
        ]);

        const total = items.reduce((acc, item) => acc + Number(item.total_harga || 0), 0);
        const roundedDown = Math.floor(total / 10000) * 10000;
        const ppn = noPpn ? 0 : roundedDown * 0.11;
        const finalTotal = roundedDown + ppn;

        await instruksiLapanganRepository.updatePdfLinks(idIL, {
            pdfGabungan: linkGabungan || "",
            pdfNonSbo: linkNonSbo || "",
            pdfRekapitulasi: linkRekap || "",
            grandTotalNonSbo: total.toString(),
            grandTotalFinal: finalTotal.toString()
        });
    },

    async list(query: ListInstruksiLapanganQuery) {
        return await instruksiLapanganRepository.findMany(query);
    },

    async getById(id: string) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const items = await instruksiLapanganRepository.getItems(id);
        return { ...data.instruksiLapangan, toko: data.toko, items };
    },

    async getPdfDownloadPayload(id: string) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const idILs = await instruksiLapanganRepository.getPairIds(data.toko.nomor_ulok, data.instruksiLapangan.status, data.instruksiLapangan.email_pembuat);
        const targetIds = idILs.length > 0 ? idILs : [Number(id)];

        let primaryData: any = null;
        const allItems: any[] = [];
        const scopes = new Set<string>();

        for (const tid of targetIds) {
            const tData = await instruksiLapanganRepository.getHeaderAndToko(tid);
            if (!tData) continue;
            
            if (!primaryData) primaryData = tData;
            
            const lingkup = tData.toko.lingkup_pekerjaan?.trim().toUpperCase() || "";
            if (lingkup) scopes.add(lingkup);
            
            const items = await instruksiLapanganRepository.getItems(tid);
            const itemsWithScope = items.map(it => ({ ...it, lingkup_pekerjaan: lingkup }));
            allItems.push(...itemsWithScope);
        }

        if (!primaryData) primaryData = data;

        const mergedToko = {
            ...primaryData.toko,
            lingkup_pekerjaan: scopes.size > 1 ? Array.from(scopes).join(" & ") : primaryData.toko.lingkup_pekerjaan
        };

        const reportBuffer = await buildInstruksiLapanganPdfBuffer({
            instruksiLapangan: primaryData.instruksiLapangan,
            items: allItems,
            toko: mergedToko
        });

        const recapBuffer = await buildInstruksiLapanganRecapPdfBuffer({
            instruksiLapangan: primaryData.instruksiLapangan,
            items: allItems,
            toko: mergedToko
        });

        const buffersToMerge: Buffer[] = [recapBuffer, reportBuffer];
        if (primaryData.instruksiLapangan.link_lampiran) {
            try {
                const lampiranBuffer = await fs.readFile(primaryData.instruksiLapangan.link_lampiran);
                if (lampiranBuffer.subarray(0, 4).toString('hex') === '25504446') {
                    buffersToMerge.push(lampiranBuffer);
                }
            } catch (err) {
                console.warn("Could not read lampiran for merging", err);
            }
        }

        const mergedBuffer = await mergePdfBuffers(buffersToMerge);

        return {
            filename: `Instruksi_Lapangan_${mergedToko.nomor_ulok}.pdf`,
            pdfBuffer: mergedBuffer
        };
    },

    async getAssetDownloadPayload(id: string, assetType: "lampiran") {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const assetPath = data.instruksiLapangan.link_lampiran;
        if (!assetPath) {
            throw new AppError(`File ${assetType} tidak tersedia untuk Instruksi Lapangan ini`, 404);
        }

        try {
            const buffer = await fs.readFile(assetPath);
            const ext = path.extname(assetPath).toLowerCase();
            const contentType = ext === ".pdf" ? "application/pdf"
                : ext === ".png" ? "image/png"
                : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
                : "application/octet-stream";

            return {
                filename: `${assetType}_${data.toko.nomor_ulok}${ext}`,
                contentType,
                fileBuffer: buffer
            };
        } catch {
            throw new AppError(`File ${assetType} tidak dapat dibaca dari server`, 500);
        }
    },

    async handleApproval(id: string, action: ApprovalActionInput) {
        const data = await instruksiLapanganRepository.getHeaderAndToko(id);
        if (!data) throw new AppError("Instruksi Lapangan tidak ditemukan", 404);

        const currentStatus = data.instruksiLapangan.status;
        
        const idsToProcess = await instruksiLapanganRepository.getPairIds(
            data.toko.nomor_ulok,
            currentStatus,
            data.instruksiLapangan.email_pembuat
        );
        const targetIds = idsToProcess.length > 0 ? idsToProcess : [Number(id)];

        if (action.tindakan === "APPROVE") {
            if (currentStatus === "Menunggu Persetujuan Koordinator") {
                if (action.jabatan !== "KOORDINATOR") {
                    throw new AppError("Instruksi Lapangan saat ini menunggu approval Koordinator", 403);
                }

                for (const targetId of targetIds) {
                    await instruksiLapanganRepository.updateApproval(
                        targetId,
                        "Menunggu Persetujuan Manager",
                        "koordinator",
                        action.approver_email,
                        undefined,
                        action.catatan_approval ?? null
                    );
                }
            } else if (currentStatus === "Menunggu Persetujuan Manager") {
                if (action.jabatan !== "MANAGER") {
                    throw new AppError("Instruksi Lapangan saat ini menunggu approval Manager", 403);
                }

                for (const targetId of targetIds) {
                    await instruksiLapanganRepository.updateApproval(
                        targetId,
                        "Disetujui",
                        "manager",
                        action.approver_email,
                        undefined,
                        action.catatan_approval ?? null
                    );
                }
            } else {
                throw new AppError(`Status tidak dapat di-approve dari state saat ini: ${currentStatus}`, 400);
            }
        } else if (action.tindakan === "REJECT") {
            const role = currentStatus === "Menunggu Persetujuan Koordinator" ? "koordinator"
                : currentStatus === "Menunggu Persetujuan Manager" ? "manager"
                : null;

            if (!role) {
                throw new AppError(`Status tidak dapat di-reject dari state saat ini: ${currentStatus}`, 400);
            }

            if (
                (role === "koordinator" && action.jabatan !== "KOORDINATOR") ||
                (role === "manager" && action.jabatan !== "MANAGER")
            ) {
                throw new AppError(`Instruksi Lapangan saat ini menunggu approval ${role === "koordinator" ? "Koordinator" : "Manager"}`, 403);
            }
            
            for (const targetId of targetIds) {
                await instruksiLapanganRepository.updateApproval(
                    targetId,
                    "Ditolak",
                    role,
                    action.approver_email,
                    action.alasan_penolakan ?? undefined,
                    action.catatan_approval ?? null
                );
            }
        } else {
            throw new AppError("Action tidak valid", 400);
        }

        // Regenerate PDF after status change
        await this.regeneratePdfWithPair(id);

        if (action.tindakan === "APPROVE" && currentStatus === "Menunggu Persetujuan Manager") {
            // Injeksi otomatis kategori IL ke Gantt Chart (background, non-blocking)
            setImmediate(() => {
                instruksiLapanganRepository.injectApprovedIlToGantt(id)
                    .then(({ injected, skipped }) => {
                        console.log(`[IL][GANTT_INJECT] IL id=${id}: ${injected} kategori diinjeksi, ${skipped} dilewati`);
                    })
                    .catch((err) => {
                        console.error(`[IL][GANTT_INJECT] Error background inject IL id=${id}:`, err?.message || err);
                    });
            });

            try {
                const pdfPayload = await this.getPdfDownloadPayload(id);
                const updatedData = await instruksiLapanganRepository.getHeaderAndToko(id);
                if (updatedData) {
                    sendILApprovalEmail(updatedData, pdfPayload.pdfBuffer, pdfPayload.filename).catch(e => {
                        console.error("[IL][EMAIL_BACKGROUND] Error:", e);
                    });
                }
            } catch (err: any) {
                console.error("[IL][EMAIL] Gagal mendapatkan PDF untuk dilampirkan:", err?.message || err);
            }
        }

        return await instruksiLapanganRepository.getById(id);
    }
};
