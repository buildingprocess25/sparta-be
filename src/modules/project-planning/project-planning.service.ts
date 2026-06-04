import { AppError } from "../../common/app-error";
import { PP_STATUS, PP_ROLE, PP_AKSI, PP_STATUS_LABEL, type PpStatus } from "./project-planning.constants";
import { projekPlanningRepository } from "./project-planning.repository";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { buildProjekPlanningPdfBuffer } from "./project-planning.pdf";
import { compressImage } from "../../common/image-compressor";

const PROJECT_PLANNING_DRIVE_FOLDER_ID = env.PROJECT_PLANNING_DRIVE_FOLDER_ID;

async function uploadCompressedFile(file: Express.Multer.File, folderId: string): Promise<string | null> {
    const { buffer, mimetype, originalname } = await compressImage(file);
    const u = await GoogleProvider.instance.uploadFile(folderId, originalname, mimetype, buffer);
    return u.webViewLink || null;
}

async function uploadCompressedFiles(files: Express.Multer.File[], folderId: string): Promise<string | undefined> {
    const links: string[] = [];
    for (const file of files.slice(0, 2)) {
        const link = await uploadCompressedFile(file, folderId);
        if (link) links.push(link);
    }
    return links.length > 0 ? links.join("\n") : undefined;
}

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

function sanitizeFilenamePart(value: unknown, fallback: string): string {
    const text = normalizeText(value) || fallback;
    return text.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 80);
}

function normalizeText(value: unknown): string {
    return String(value ?? "").trim();
}

function normalizeBoolean(value: unknown): boolean {
    return value === true || value === "true" || value === "1" || value === 1;
}

function normalizeBeanspotTipe(value: unknown): string | null {
    const text = normalizeText(value);
    if (!text) return null;
    return text.toUpperCase() === "BASIC" ? "RTD ONLY" : text;
}

function normalizeCabang(value: unknown): string {
    return normalizeText(value).toUpperCase();
}

function isDarkStoreDesign(value: unknown): boolean {
    return normalizeText(value)
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .includes("DARK STORE");
}

function shouldSkipBmApproval(cabang: unknown): boolean {
    return ["BOGOR", "BATAM"].includes(normalizeCabang(cabang));
}

function isBogorBranch(cabang: unknown): boolean {
    return normalizeCabang(cabang) === "BOGOR";
}

function getInitialSubmitMeta(cabang: unknown) {
    const skipBm = shouldSkipBmApproval(cabang);
    return {
        status: skipBm ? PP_STATUS.WAITING_PP_APPROVAL_1 : PP_STATUS.WAITING_BM_APPROVAL,
        role: isBogorBranch(cabang) ? PP_ROLE.BM : PP_ROLE.COORDINATOR,
        keterangan: skipBm
            ? "FPD berhasil diajukan, bypass approval BM Manager sesuai alur cabang khusus, menunggu approval PP Specialist tahap 1"
            : "FPD berhasil diajukan oleh Coordinator, menunggu approval BM Manager",
    };
}

function normalizeArrayForCompare(value: unknown): string {
    if (!Array.isArray(value)) return "[]";
    return JSON.stringify(value.map((item) => {
        if (item && typeof item === "object") {
            return Object.keys(item as Record<string, unknown>)
                .sort()
                .reduce<Record<string, unknown>>((acc, key) => {
                    acc[key] = (item as Record<string, unknown>)[key];
                    return acc;
                }, {});
        }
        return item;
    }));
}

function buildRevisionSummary(
    projek: any,
    payload: any,
    links: {
        link_fpd?: string | null;
        link_gambar_kerja?: string | null;
        link_gambar_kompetitor?: string | null;
        link_siteplan?: string | null;
    }
): string {
    const changed: string[] = [];
    const addIfChanged = (label: string, before: unknown, after: unknown) => {
        if (normalizeText(before) !== normalizeText(after)) changed.push(label);
    };
    const addBoolIfChanged = (label: string, before: unknown, after: unknown) => {
        if (normalizeBoolean(before) !== normalizeBoolean(after)) changed.push(label);
    };

    addIfChanged("Nama toko/lokasi", projek.nama_lokasi || projek.nama_toko, payload.nama_lokasi || payload.nama_toko);
    addIfChanged("Link Google Maps", projek.link_google_maps, payload.link_google_maps);
    addIfChanged("Lingkup pekerjaan", projek.lingkup_pekerjaan, payload.lingkup_pekerjaan);
    addIfChanged("Jenis proyek", projek.jenis_proyek, payload.jenis_proyek);
    addIfChanged("Estimasi biaya", projek.estimasi_biaya, payload.estimasi_biaya);
    addIfChanged("Keterangan", projek.keterangan, payload.keterangan);
    addIfChanged("Jenis pengajuan", projek.jenis_pengajuan, payload.jenis_pengajuan);
    addIfChanged("Jenis pengajuan lainnya", projek.jenis_pengajuan_lainnya, payload.jenis_pengajuan_lainnya);
    addBoolIfChanged("Ruko / non-ruko", projek.is_ruko, payload.is_ruko);
    addIfChanged("Jumlah lantai", projek.jumlah_lantai, payload.jumlah_lantai);
    addBoolIfChanged("Head to head", projek.is_head_to_head, payload.is_head_to_head);
    addBoolIfChanged("Seating area", projek.is_seating_area, payload.is_seating_area);
    addBoolIfChanged("Kategori toko B2B", projek.is_dark_store, payload.is_dark_store);
    addIfChanged("Tipe Bean Spot", normalizeBeanspotTipe(projek.beanspot_tipe), normalizeBeanspotTipe(payload.beanspot_tipe));

    if (normalizeArrayForCompare(projek.ketentuan?.map((k: any) => k.isi_ketentuan) ?? []) !== normalizeArrayForCompare(payload.ketentuan ?? [])) changed.push("Ketentuan");
    if (normalizeArrayForCompare(projek.catatan_design?.map((c: any) => c.isi_catatan) ?? []) !== normalizeArrayForCompare(payload.catatan_design ?? [])) changed.push("Catatan design");
    if (normalizeArrayForCompare(projek.fasilitas ?? []) !== normalizeArrayForCompare(payload.fasilitas ?? [])) changed.push("Fasilitas");

    addIfChanged("File/Link FPD", projek.link_fpd, links.link_fpd);
    addIfChanged("Siteplan", projek.link_siteplan, links.link_siteplan);
    addIfChanged("Gambar kerja ME", projek.link_gambar_kerja, links.link_gambar_kerja);
    addIfChanged("Gambar kompetitor", projek.link_gambar_kompetitor, links.link_gambar_kompetitor);

    return changed.length > 0
        ? `Perubahan revisi: ${changed.join(", ")}.`
        : "Perubahan revisi: tidak terdeteksi detail perubahan.";
}

function buildApprovalNote(prefix: string, catatan?: string | null): string {
    const note = normalizeText(catatan);
    return note ? `${prefix}. Catatan: ${note}` : prefix;
}

function getApprovedRabByLingkup(approvedRabs: any[], lingkup: "SIPIL" | "ME") {
    return approvedRabs.find((rab) => normalizeText(rab.lingkup_pekerjaan).toUpperCase().includes(lingkup)) ?? null;
}

function buildFinalReviewSummary(action: FinalReviewInput): string {
    const parts = [
        `RAB ${action.rab_tindakan === "APPROVE" ? "disetujui" : "ditolak"}`,
        `Gambar final ${action.gambar_tindakan === "APPROVE" ? "disetujui" : "ditolak"}`,
    ];
    if (action.rab_rejected_item_ids.length > 0) parts.push(`Item RAB perlu revisi: ${action.rab_rejected_item_ids.join(", ")}`);
    if (action.rab_rejected_item_notes?.trim()) parts.push(`Catatan item RAB: ${action.rab_rejected_item_notes.trim()}`);
    if (action.catatan?.trim()) parts.push(`Catatan: ${action.catatan.trim()}`);
    return parts.join(". ");
}

function getFinalReviewRejectReason(action: FinalReviewInput, reviewSummary: string): string {
    return normalizeText(action.alasan_penolakan)
        || normalizeText(action.rab_rejected_item_notes)
        || reviewSummary;
}

import type {
    SubmitProjekPlanningInput,
    ResubmitProjekPlanningInput,
    ApprovalInput,
    PpApproval1Input,
    FinalReviewInput,
    Upload3dInput,
    UploadRabInput,
    ListProjekPlanningQuery,
    ProjekPlanningInterventionInput,
} from "./project-planning.schema";

export const projekPlanningService = {

    // ============================================================
    // SUBMIT FPD (Coordinator) — record baru
    // ============================================================

    async submit(payload: SubmitProjekPlanningInput, files?: Express.Multer.File[]) {
        const nomorUlok = normalizeText(payload.nomor_ulok);
        if (!nomorUlok) {
            throw new AppError("Nomor ULOK wajib diisi", 422);
        }

        // Project Planning berdiri sendiri, jadi tidak membuat/mengubah master toko.
        const existingActive = await projekPlanningRepository.findActiveByNomorUlok(nomorUlok);
        if (existingActive) {
            throw new AppError(
                `ULOK ini sudah memiliki project planning aktif dengan status: ${PP_STATUS_LABEL[existingActive.status]}`,
                409
            );
        }

        const existingDraft = await projekPlanningRepository.findDraftByNomorUlok(nomorUlok);
        if (existingDraft) {
            throw new AppError(
                `ULOK ini sudah memiliki project planning DRAFT (ID: ${existingDraft.id}). Gunakan endpoint resubmit (POST /:id/resubmit) untuk mengajukan ulang.`,
                409
            );
        }

        // Upload file to Google Drive if provided
        let fpdLink = payload.link_fpd;
        let gambarKerjaMe = payload.link_gambar_kerja;
        let gambarKompetitor = payload.link_gambar_kompetitor;
        let siteplanLink = payload.link_siteplan;
        let fotoItemsLinks: { item_index: number; link_foto: string }[] = [];

        if (files && files.length > 0) {
            const fFpd = files.filter(f => f.fieldname === "file_fpd");
            const fGambarKerjaMe = files.filter(f => f.fieldname === "file_gambar_kerja_me");
            const fKompetitor = files.filter(f => f.fieldname === "file_gambar_kompetitor");
            const fSiteplan = files.filter(f => f.fieldname === "file_siteplan");

            const itemRegex = /^foto_items_(\d+)$/i;

            try {
                if (fFpd.length > 0) {
                    const link = await uploadCompressedFiles(fFpd, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) fpdLink = link;
                }
                if (fGambarKerjaMe.length > 0) {
                    const link = await uploadCompressedFiles(fGambarKerjaMe, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) gambarKerjaMe = link;
                }
                if (fKompetitor.length > 0) {
                    const uploadedLinks: string[] = [];
                    for (const [idx, file] of fKompetitor.slice(0, 2).entries()) {
                        const link = await uploadCompressedFile(file, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                        if (link) {
                            uploadedLinks.push(link);
                            fotoItemsLinks.push({ item_index: 39 + idx, link_foto: link });
                        }
                    }
                    const link = uploadedLinks.length > 0 ? uploadedLinks.join("\n") : undefined;
                    if (link) gambarKompetitor = link;
                }
                if (fSiteplan.length > 0) {
                    const link = await uploadCompressedFiles(fSiteplan, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) siteplanLink = link;
                }

                // Process foto_items_X
                for (const file of files) {
                    const match = itemRegex.exec(file.fieldname);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        if (!isNaN(index)) {
                            const link = await uploadCompressedFile(file, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                            if (link) fotoItemsLinks.push({ item_index: index, link_foto: link });
                        }
                    }
                }
            } catch (e) {
                console.error("Gagal upload file FPD/RAB/Foto ke Drive:", e);
                throw new AppError("Gagal upload file FPD/RAB/Foto ke Drive", 502);
            }
        }

        const initialMeta = getInitialSubmitMeta(payload.cabang);
        const darkStoreDesign = isDarkStoreDesign(payload.jenis_pengajuan);
        if (payload.is_head_to_head && gambarKompetitor && !fotoItemsLinks.some((item) => item.item_index === 39)) {
            normalizeText(gambarKompetitor)
                .split(/\r?\n/)
                .map((link) => link.trim())
                .filter(Boolean)
                .slice(0, 2)
                .forEach((link, idx) => fotoItemsLinks.push({ item_index: 39 + idx, link_foto: link }));
        }

        // Buat record baru sesuai alur cabang
        const created = await projekPlanningRepository.create({
            ...payload,
            is_head_to_head: darkStoreDesign ? false : payload.is_head_to_head,
            jarak_head_to_head: darkStoreDesign ? null : payload.jarak_head_to_head,
            is_seating_area: darkStoreDesign ? false : payload.is_seating_area,
            is_dark_store: darkStoreDesign ? false : payload.is_dark_store,
            id_toko: payload.id_toko ?? 0,
            nomor_ulok: nomorUlok,
            nama_toko: payload.nama_toko || payload.nama_lokasi || null,
            kode_toko: payload.kode_toko || null,
            cabang: payload.cabang || null,
            alamat_toko: payload.alamat_toko || null,
            link_google_maps: payload.link_google_maps || null,
            proyek: payload.jenis_proyek || null,
            beanspot_tipe: normalizeBeanspotTipe(payload.beanspot_tipe),
            link_fpd: fpdLink ?? undefined,
            link_siteplan: siteplanLink ?? undefined,
            link_gambar_kerja: gambarKerjaMe ?? undefined,
            link_gambar_kompetitor: gambarKompetitor ?? undefined,
            status: initialMeta.status,
        } as any);

        // 6. Catat log
        await projekPlanningRepository.insertLog({
            projek_planning_id: created.id,
            actor_email: payload.email_pembuat,
            role: initialMeta.role,
            aksi: PP_AKSI.SUBMIT,
            status_sebelum: null,
            status_sesudah: initialMeta.status,
            keterangan: initialMeta.keterangan,
        });

        if (fotoItemsLinks.length > 0) {
            await projekPlanningRepository.createFotoItemsBulk(created.id, fotoItemsLinks);
        }

        return created;
    },

    // ============================================================
    // RESUBMIT FPD (Coordinator) — update record DRAFT yang sudah ada
    // ============================================================

    async resubmit(id: number, payload: ResubmitProjekPlanningInput, files?: Express.Multer.File[]) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.DRAFT) {
            throw new AppError(
                `Resubmit hanya bisa dilakukan pada record DRAFT. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        // Upload file if provided
        let fpdLink = payload.link_fpd;
        let gambarKerjaMe = payload.link_gambar_kerja;
        let gambarKompetitor = payload.link_gambar_kompetitor;
        let siteplanLink = payload.link_siteplan;
        let fotoItemsLinks: { item_index: number; link_foto: string }[] = [];

        if (files && files.length > 0) {
            const fFpd = files.filter(f => f.fieldname === "file_fpd");
            const fGambarKerjaMe = files.filter(f => f.fieldname === "file_gambar_kerja_me");
            const fKompetitor = files.filter(f => f.fieldname === "file_gambar_kompetitor");
            const fSiteplan = files.filter(f => f.fieldname === "file_siteplan");

            const itemRegex = /^foto_items_(\d+)$/i;

            try {
                if (fFpd.length > 0) {
                    const link = await uploadCompressedFiles(fFpd, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) fpdLink = link;
                }
                if (fGambarKerjaMe.length > 0) {
                    const link = await uploadCompressedFiles(fGambarKerjaMe, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) gambarKerjaMe = link;
                }
                if (fKompetitor.length > 0) {
                    const uploadedLinks: string[] = [];
                    for (const [idx, file] of fKompetitor.slice(0, 2).entries()) {
                        const link = await uploadCompressedFile(file, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                        if (link) {
                            uploadedLinks.push(link);
                            fotoItemsLinks.push({ item_index: 39 + idx, link_foto: link });
                        }
                    }
                    const link = uploadedLinks.length > 0 ? uploadedLinks.join("\n") : undefined;
                    if (link) gambarKompetitor = link;
                }
                if (fSiteplan.length > 0) {
                    const link = await uploadCompressedFiles(fSiteplan, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) siteplanLink = link;
                }

                // Process foto_items_X
                for (const file of files) {
                    const match = itemRegex.exec(file.fieldname);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        if (!isNaN(index)) {
                            const link = await uploadCompressedFile(file, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                            if (link) fotoItemsLinks.push({ item_index: index, link_foto: link });
                        }
                    }
                }
            } catch (e) {
                console.error("Gagal upload file FPD/RAB/Foto ke Drive:", e);
                throw new AppError("Gagal upload file FPD/RAB/Foto ke Drive", 502);
            }
        }

        // Update record DRAFT → WAITING_BM_APPROVAL
        const initialMeta = getInitialSubmitMeta(payload.cabang || projek.cabang);
        const darkStoreDesign = isDarkStoreDesign(payload.jenis_pengajuan);
        if (payload.is_head_to_head && gambarKompetitor && !fotoItemsLinks.some((item) => item.item_index === 39)) {
            normalizeText(gambarKompetitor)
                .split(/\r?\n/)
                .map((link) => link.trim())
                .filter(Boolean)
                .slice(0, 2)
                .forEach((link, idx) => fotoItemsLinks.push({ item_index: 39 + idx, link_foto: link }));
        }
        const revisionSummary = buildRevisionSummary(projek, payload, {
            link_fpd: fpdLink ?? projek.link_fpd ?? null,
            link_siteplan: siteplanLink ?? projek.link_siteplan ?? null,
            link_gambar_kerja: gambarKerjaMe ?? projek.link_gambar_kerja ?? null,
            link_gambar_kompetitor: gambarKompetitor ?? projek.link_gambar_kompetitor ?? null,
        });

        const updated = await projekPlanningRepository.resubmitDraft(id, {
            ...payload,
            is_head_to_head: darkStoreDesign ? false : payload.is_head_to_head,
            jarak_head_to_head: darkStoreDesign ? null : payload.jarak_head_to_head,
            is_seating_area: darkStoreDesign ? false : payload.is_seating_area,
            is_dark_store: darkStoreDesign ? false : payload.is_dark_store,
            nama_toko: payload.nama_toko || payload.nama_lokasi || projek.nama_toko || null,
            kode_toko: payload.kode_toko || projek.kode_toko || null,
            cabang: payload.cabang || projek.cabang || null,
            alamat_toko: payload.alamat_toko || projek.alamat_toko || null,
            link_google_maps: payload.link_google_maps || projek.link_google_maps || null,
            proyek: payload.jenis_proyek || projek.proyek || null,
            beanspot_tipe: normalizeBeanspotTipe(payload.beanspot_tipe),
            link_fpd: fpdLink ?? projek.link_fpd ?? undefined,
            link_siteplan: siteplanLink ?? projek.link_siteplan ?? undefined,
            link_gambar_kerja: gambarKerjaMe ?? projek.link_gambar_kerja ?? undefined,
            link_gambar_kompetitor: gambarKompetitor ?? projek.link_gambar_kompetitor ?? undefined,
            status: initialMeta.status,
        } as any);

        // Catat log
        await projekPlanningRepository.insertLog({
            projek_planning_id: id,
            actor_email: payload.email_pembuat,
            role: initialMeta.role,
            aksi: PP_AKSI.SUBMIT,
            status_sebelum: PP_STATUS.DRAFT,
            status_sesudah: initialMeta.status,
            keterangan: `FPD diajukan ulang setelah penolakan. ${initialMeta.keterangan}. ${revisionSummary}`,
        });

        if (fotoItemsLinks.length > 0) {
            for (const item of fotoItemsLinks) {
                await projekPlanningRepository.upsertFotoItem(id, item.item_index, item.link_foto);
            }
        }

        return updated;
    },

    // ============================================================
    // LIST
    // ============================================================

    async list(query: ListProjekPlanningQuery) {
        return projekPlanningRepository.list(query);
    },



    // ============================================================
    // GENERATE PDF
    // ============================================================

    async generatePdf(projekPlanningId: number): Promise<Buffer> {
        const item = await projekPlanningRepository.findById(projekPlanningId);
        if (!item) {
            throw new AppError("Data Project Planning tidak ditemukan", 404);
        }

        return buildProjekPlanningPdfBuffer(item.projek);
    },

    async generatePdfAndStoreLink(projekPlanningId: number): Promise<{ buffer: Buffer; link_pdf: string }> {
        const item = await projekPlanningRepository.findById(projekPlanningId);
        if (!item) {
            throw new AppError("Data Project Planning tidak ditemukan", 404);
        }

        const buffer = await buildProjekPlanningPdfBuffer(item.projek);
        const filename = `PROJECT_PLANNING_${sanitizeFilenamePart(item.projek.nomor_ulok, String(projekPlanningId))}_${projekPlanningId}.pdf`;
        const linkPdf = await uploadPdfToDrive(buffer, filename);

        await projekPlanningRepository.updatePdfLink(projekPlanningId, linkPdf);

        return { buffer, link_pdf: linkPdf };
    },

    // ============================================================
    // GET BY ID
    // ============================================================

    async getById(id: number) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) {
            throw new AppError("Project planning tidak ditemukan", 404);
        }
        return data;
    },

    // ============================================================
    // BM APPROVAL
    // ============================================================

    async bmApproval(id: number, action: ApprovalInput) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        const isStage2 = projek.status === PP_STATUS.WAITING_BM_APPROVAL_2;
        if (!([PP_STATUS.WAITING_BM_APPROVAL, PP_STATUS.WAITING_BM_APPROVAL_2] as PpStatus[]).includes(projek.status)) {
            throw new AppError(
                `Aksi tidak valid. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        const isApprove = action.tindakan === "APPROVE";
        const newStatus = isStage2
            ? (isApprove ? PP_STATUS.WAITING_PP_APPROVAL_2 : PP_STATUS.WAITING_RAB_UPLOAD)
            : (isApprove ? PP_STATUS.WAITING_PP_APPROVAL_1 : PP_STATUS.DRAFT);
        const approveMessage = isStage2
            ? "Disetujui oleh BM Manager tahap 2, menunggu approval PP Specialist tahap 2"
            : "Disetujui oleh BM Manager, menunggu approval PP Specialist";
        const rejectMessage = isStage2
            ? `Ditolak oleh BM Manager tahap 2: ${action.alasan_penolakan}. Dikembalikan ke Coordinator untuk input ulang tahap kedua`
            : `Ditolak oleh BM Manager: ${action.alasan_penolakan}. Dikembalikan ke Coordinator dari awal`;

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: action.approver_email,
                role: PP_ROLE.BM,
                aksi: isApprove ? PP_AKSI.APPROVE : PP_AKSI.REJECT,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                alasan_penolakan: action.alasan_penolakan ?? null,
                keterangan: isApprove
                    ? buildApprovalNote(approveMessage, action.catatan)
                    : rejectMessage,
            },
            isStage2
                ? (client) => projekPlanningRepository.updateStatusAndBm2Approval(id, newStatus, action, client)
                : isApprove
                    ? (client) => projekPlanningRepository.updateStatusAndBmApproval(id, newStatus, action, client)
                    : (client) => projekPlanningRepository.updateStatusAndRejectToDraft(id, PP_ROLE.BM, action, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            tindakan: action.tindakan,
        };
    },

    // ============================================================
    // PP APPROVAL STAGE 1
    // ============================================================

    async ppApproval1(id: number, action: PpApproval1Input) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.WAITING_PP_APPROVAL_1) {
            throw new AppError(
                `Aksi tidak valid. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        const isApprove = action.tindakan === "APPROVE";

        let newStatus: PpStatus = PP_STATUS.DRAFT;
        let keterangan = `Ditolak oleh PP Specialist (Tahap 1): ${action.alasan_penolakan}. Dikembalikan ke pengaju dari awal`;

        if (isApprove) {
            if (action.butuh_desain_3d) {
                newStatus = PP_STATUS.PP_DESIGN_3D_REQUIRED;
                keterangan = "Disetujui oleh PP Specialist, PP perlu membuat desain 3D";
            } else {
                newStatus = PP_STATUS.WAITING_RAB_UPLOAD;
                keterangan = "Disetujui oleh PP Specialist (tanpa 3D), Cabang dapat mengisi fasilitas, memilih RAB Sparta approved, dan mengupload gambar final";
            }
            keterangan = buildApprovalNote(keterangan, action.catatan);
        }

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: action.approver_email,
                role: PP_ROLE.PP_SPECIALIST,
                aksi: isApprove ? PP_AKSI.APPROVE : PP_AKSI.REJECT,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                alasan_penolakan: action.alasan_penolakan ?? null,
                keterangan,
            },
            isApprove
                ? (client) => projekPlanningRepository.updateStatusAndPp1Approval(id, newStatus, action, client)
                : (client) => projekPlanningRepository.updateStatusAndRejectToDraft(id, PP_ROLE.PP_SPECIALIST, action, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            tindakan: action.tindakan,
            butuh_desain_3d: action.butuh_desain_3d ?? false,
        };
    },

    // ============================================================
    // UPLOAD DESAIN 3D (PP Specialist)
    // ============================================================

    async upload3d(id: number, payload: Upload3dInput, file?: Express.Multer.File) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.PP_DESIGN_3D_REQUIRED) {
            throw new AppError(
                `Upload 3D tidak diperlukan saat ini. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        // Upload file to Drive if provided
        let link3d = payload.link_desain_3d;
        if (file) {
            try {
                const uploaded = await GoogleProvider.instance.uploadFile(
                    PROJECT_PLANNING_DRIVE_FOLDER_ID,
                    file.originalname,
                    file.mimetype,
                    file.buffer
                );
                if (uploaded.webViewLink) link3d = uploaded.webViewLink;
            } catch (e) {
                console.error("Gagal upload 3D ke Drive:", e);
                throw new AppError("Gagal upload Desain 3D ke Drive", 502);
            }
        }

        const newStatus = PP_STATUS.WAITING_RAB_UPLOAD;

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: payload.uploader_email,
                role: PP_ROLE.PP_SPECIALIST,
                aksi: PP_AKSI.UPLOAD_3D,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                keterangan: payload.keterangan ?? "Desain 3D berhasil diupload, Cabang dapat mengupload RAB & Gambar Kerja",
            },
            (client) => projekPlanningRepository.updateDesain3d(id, newStatus, { ...payload, link_desain_3d: link3d }, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            link_desain_3d: link3d,
        };
    },

    // ============================================================
    // UPLOAD RAB & GAMBAR KERJA (Coordinator/Cabang)
    // ============================================================

    async uploadRab(id: number, payload: UploadRabInput, files?: { [fieldname: string]: Express.Multer.File[] }) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.WAITING_RAB_UPLOAD) {
            throw new AppError(
                `Upload RAB tidak diperlukan saat ini. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        // Upload file if provided
        let linkRabSipil = payload.link_rab_sipil;
        let linkRabMe = payload.link_rab_me;
        let linkGambarSipil = payload.link_gambar_kerja_final_sipil;
        let linkGambarMe = payload.link_gambar_kerja_final_me;
        const approvedRabs = await projekPlanningRepository.findApprovedRabsByNomorUlok(projek.nomor_ulok);
        if (approvedRabs.length === 0) {
            throw new AppError(
                "RAB untuk ULOK ini belum diinput kontraktor atau belum selesai approval. Input dan approve RAB terlebih dahulu sebelum melanjutkan FPD.",
                422
            );
        }

        const selectedRabSipil = payload.id_rab_sipil
            ? approvedRabs.find((rab) => rab.id === payload.id_rab_sipil)
            : getApprovedRabByLingkup(approvedRabs, "SIPIL");
        const selectedRabMe = payload.id_rab_me
            ? approvedRabs.find((rab) => rab.id === payload.id_rab_me)
            : getApprovedRabByLingkup(approvedRabs, "ME");

        if (payload.id_rab_sipil && !selectedRabSipil) {
            throw new AppError("RAB Sipil yang dipilih tidak ditemukan atau belum approved untuk ULOK ini.", 422);
        }
        if (payload.id_rab_me && !selectedRabMe) {
            throw new AppError("RAB ME yang dipilih tidak ditemukan atau belum approved untuk ULOK ini.", 422);
        }
        if (!selectedRabSipil && !selectedRabMe) {
            throw new AppError(
                "RAB approved tersedia, tetapi belum ada RAB dengan lingkup Sipil atau ME untuk ULOK ini.",
                422
            );
        }
        linkRabSipil = linkRabSipil || selectedRabSipil?.link_pdf_gabungan || undefined;
        linkRabMe = linkRabMe || selectedRabMe?.link_pdf_gabungan || undefined;
        
        if (files) {
            const fGambarSipil = files["file_gambar_kerja_final_sipil"] ?? [];
            const fGambarMe = files["file_gambar_kerja_final_me"] ?? [];
            
            try {
                if (fGambarSipil.length > 0) {
                    const link = await uploadCompressedFiles(fGambarSipil, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) linkGambarSipil = link;
                }
                if (fGambarMe.length > 0) {
                    const link = await uploadCompressedFiles(fGambarMe, PROJECT_PLANNING_DRIVE_FOLDER_ID);
                    if (link) linkGambarMe = link;
                }
            } catch (e) {
                console.error("Gagal upload RAB/Gambar ke Drive:", e);
                throw new AppError("Gagal upload RAB/Gambar ke Drive", 502);
            }
        }

        const newStatus = PP_STATUS.WAITING_BM_APPROVAL_2;

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: payload.uploader_email,
                role: isBogorBranch(projek.cabang) ? PP_ROLE.BM : PP_ROLE.COORDINATOR,
                aksi: PP_AKSI.UPLOAD_RAB,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                keterangan: payload.keterangan ?? "Input tahap kedua berhasil dikirim, menunggu approval B&M Manager tahap 2",
            },
            (client) => projekPlanningRepository.updateRabUpload(id, newStatus, {
                ...payload,
                link_rab_sipil: linkRabSipil,
                link_rab_me: linkRabMe,
                id_rab_sipil: selectedRabSipil?.id,
                id_rab_me: selectedRabMe?.id,
                link_gambar_kerja_final_sipil: linkGambarSipil,
                link_gambar_kerja_final_me: linkGambarMe,
            }, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            link_rab_sipil: linkRabSipil ?? null,
            link_rab_me: linkRabMe ?? null,
            link_gambar_kerja_final_sipil: linkGambarSipil ?? null,
            link_gambar_kerja_final_me: linkGambarMe ?? null,
        };
    },

    // ============================================================
    // PP APPROVAL STAGE 2 (PP Specialist, setelah RAB)
    // ============================================================

    async ppApproval2(id: number, action: FinalReviewInput) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.WAITING_PP_APPROVAL_2) {
            throw new AppError(
                `Aksi tidak valid. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        const isApprove = action.rab_tindakan === "APPROVE" && action.gambar_tindakan === "APPROVE";
        const newStatus = isApprove ? PP_STATUS.WAITING_PP_MANAGER_APPROVAL : PP_STATUS.WAITING_RAB_UPLOAD;
        const reviewSummary = buildFinalReviewSummary(action);
        const rejectReason = getFinalReviewRejectReason(action, reviewSummary);

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: action.approver_email,
                role: PP_ROLE.PP_SPECIALIST,
                aksi: isApprove ? PP_AKSI.APPROVE : PP_AKSI.REJECT,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                alasan_penolakan: isApprove ? null : rejectReason,
                keterangan: isApprove
                    ? `Disetujui oleh PP Specialist, menunggu approval final PP Manager. ${reviewSummary}`
                    : `Ditolak oleh PP Specialist (Tahap 2): ${rejectReason}. ${reviewSummary}. Dikembalikan sesuai bagian yang perlu revisi`,
            },
            async (client) => {
                const updated = await projekPlanningRepository.updateStatusAndFinalReview(id, newStatus, PP_ROLE.PP_SPECIALIST, action, client);
                if (action.rab_tindakan === "REJECT") {
                    const rabIds = [projek.id_rab_sipil, projek.id_rab_me].filter((rabId): rabId is number => !!rabId);
                    await projekPlanningRepository.markRabNeedsRevision(
                        rabIds,
                        action.approver_email,
                        `FPD #${id} ditolak PP Specialist. Lihat detail revisi RAB di Project Planning.`,
                        client
                    );
                }
                return updated;
            }
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            rab_tindakan: action.rab_tindakan,
            gambar_tindakan: action.gambar_tindakan,
        };
    },

    // ============================================================
    // PP MANAGER APPROVAL (Tahap Final)
    // ============================================================

    async ppManagerApproval(id: number, action: FinalReviewInput) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.WAITING_PP_MANAGER_APPROVAL) {
            throw new AppError(
                `Aksi tidak valid. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        const isApprove = action.rab_tindakan === "APPROVE" && action.gambar_tindakan === "APPROVE";
        const newStatus = isApprove ? PP_STATUS.COMPLETED : PP_STATUS.WAITING_RAB_UPLOAD;
        const reviewSummary = buildFinalReviewSummary(action);
        const rejectReason = getFinalReviewRejectReason(action, reviewSummary);

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: action.approver_email,
                role: PP_ROLE.PP_MANAGER,
                aksi: isApprove ? PP_AKSI.COMPLETE : PP_AKSI.REJECT,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                alasan_penolakan: isApprove ? null : rejectReason,
                keterangan: isApprove
                    ? `Disetujui final oleh PP Manager. FPD dikirim ke Cabang. Project planning SELESAI. ${reviewSummary}`
                    : `Ditolak oleh PP Manager: ${rejectReason}. ${reviewSummary}. Dikembalikan sesuai bagian yang perlu revisi`,
            },
            async (client) => {
                const updated = await projekPlanningRepository.updateStatusAndFinalReview(id, newStatus, PP_ROLE.PP_MANAGER, action, client);
                if (action.rab_tindakan === "REJECT") {
                    const rabIds = [projek.id_rab_sipil, projek.id_rab_me].filter((rabId): rabId is number => !!rabId);
                    await projekPlanningRepository.markRabNeedsRevision(
                        rabIds,
                        action.approver_email,
                        `FPD #${id} ditolak PP Manager. Lihat detail revisi RAB di Project Planning.`,
                        client
                    );
                }
                return updated;
            }
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            rab_tindakan: action.rab_tindakan,
            gambar_tindakan: action.gambar_tindakan,
            completed: isApprove,
        };
    },

    // ============================================================
    // GET LOGS (Audit Trail)
    // ============================================================

    async getLogs(id: number) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);
        return data.logs;
    },

    async intervene(id: number, action: ProjekPlanningInterventionInput) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status === action.target_status) {
            throw new AppError("Status Project Planning sudah sama dengan target intervensi", 409);
        }

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: action.actor_email,
                role: PP_ROLE.SUPER_HUMAN,
                aksi: PP_AKSI.INTERVENTION,
                status_sebelum: projek.status,
                status_sesudah: action.target_status,
                alasan_penolakan: null,
                keterangan: `[INTERVENSI SUPER HUMAN] ${projek.status} -> ${action.target_status}. Actor role: ${action.actor_role}. Alasan: ${action.alasan_intervensi}`,
            },
            (client) => projekPlanningRepository.updateStatusOnly(id, action.target_status, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
        };
    },

    async getTaskCounts(input: { roles?: string[]; cabang?: string; email?: string }) {
        const roles = (input.roles ?? []).map((role) => role.toUpperCase());
        const hasRole = (keyword: string) => roles.some((role) => role.includes(keyword));

        let approval = 0;
        let projectPlanning = 0;

        if (hasRole("BRANCH BUILDING COORDINATOR")) {
            projectPlanning += await projekPlanningRepository.countCoordinatorTasks(input.cabang, input.email);
        }

        if (hasRole("BRANCH BUILDING & MAINTENANCE MANAGER") || hasRole("MAINTENANCE MANAGER") || hasRole("BBMM")) {
            approval += await projekPlanningRepository.countByStatuses(
                [PP_STATUS.WAITING_BM_APPROVAL, PP_STATUS.WAITING_BM_APPROVAL_2],
                input.cabang
            );
        }

        if (hasRole("PROJECT PLANNING & DEVELOPMENT SPECIALIST")) {
            approval += await projekPlanningRepository.countByStatuses([
                PP_STATUS.WAITING_PP_APPROVAL_1,
                PP_STATUS.PP_DESIGN_3D_REQUIRED,
                PP_STATUS.WAITING_PP_APPROVAL_2,
            ]);
        }

        if (hasRole("PROJECT PLANNING & DEVELOPMENT MANAGER")) {
            approval += await projekPlanningRepository.countByStatuses([
                PP_STATUS.WAITING_PP_MANAGER_APPROVAL,
            ]);
        }

        return {
            approval,
            projectPlanning,
            total: approval + projectPlanning,
        };
    },

    // ============================================================
    // GET ONE — full detail (dipakai proxy file & PDF)
    // ============================================================

    async getOne(id: number) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);
        return data.projek;
    },
};
