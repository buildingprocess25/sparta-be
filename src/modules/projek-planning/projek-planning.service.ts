import { AppError } from "../../common/app-error";
import { tokoRepository } from "../toko/toko.repository";
import { PP_STATUS, PP_ROLE, PP_AKSI, PP_STATUS_LABEL, type PpStatus } from "./projek-planning.constants";
import { projekPlanningRepository } from "./projek-planning.repository";
import { GoogleProvider } from "../../common/google";
import { env } from "../../config/env";
import { buildProjekPlanningPdfBuffer } from "./projek-planning.pdf";
import { compressImage } from "../../common/image-compressor";

async function uploadCompressedFile(file: Express.Multer.File, folderId: string): Promise<string | null> {
    const { buffer, mimetype, originalname } = await compressImage(file);
    const u = await GoogleProvider.instance.uploadFile(folderId, originalname, mimetype, buffer);
    return u.webViewLink || null;
}

import type {
    SubmitProjekPlanningInput,
    ResubmitProjekPlanningInput,
    ApprovalInput,
    PpApproval1Input,
    Upload3dInput,
    UploadRabInput,
    ListProjekPlanningQuery,
} from "./projek-planning.schema";

export const projekPlanningService = {

    // ============================================================
    // SUBMIT FPD (Coordinator) — record baru
    // ============================================================

    async submit(payload: SubmitProjekPlanningInput, files?: Express.Multer.File[]) {
        // 1. Validasi toko
        let toko: any;
        if (payload.id_toko === 0) {
            // Upsert / Create new toko manually
            toko = await tokoRepository.create({
                nomor_ulok: payload.nomor_ulok,
                nama_toko: payload.nama_toko ?? "Toko Baru",
                kode_toko: payload.kode_toko ?? "0000",
                cabang: payload.cabang ?? "UNKNOWN",
                alamat: payload.alamat_toko ?? "-",
            });
            payload.id_toko = toko.id;
        } else {
            const existingToko = await tokoRepository.findById(payload.id_toko);
            if (!existingToko) {
                throw new AppError("id_toko tidak ditemukan di master toko", 404);
            }
            if (existingToko.nomor_ulok !== payload.nomor_ulok) {
                throw new AppError("id_toko tidak cocok dengan nomor_ulok", 409);
            }
            toko = existingToko;
        }

        // 2. Cek apakah sudah ada projek planning AKTIF untuk toko ini
        const existingActive = await projekPlanningRepository.findActiveByTokoId(payload.id_toko);
        if (existingActive) {
            throw new AppError(
                `Toko ini sudah memiliki project planning aktif dengan status: ${PP_STATUS_LABEL[existingActive.status]}`,
                409
            );
        }

        // 3. Cek apakah ada DRAFT yang bisa di-resubmit
        const existingDraft = await projekPlanningRepository.findDraftByTokoId(payload.id_toko);
        if (existingDraft) {
            throw new AppError(
                `Toko ini sudah memiliki project planning DRAFT (ID: ${existingDraft.id}). Gunakan endpoint resubmit (POST /:id/resubmit) untuk mengajukan ulang.`,
                409
            );
        }

        // 4. Upload file to Google Drive if provided
        let fpdLink = payload.link_fpd;
        let rabSipilLink = payload.link_gambar_rab_sipil;
        let rabMeLink = payload.link_gambar_rab_me;
        let fotoItemsLinks: { item_index: number; link_foto: string }[] = [];

        if (files && files.length > 0) {
            const fFpd = files.find(f => f.fieldname === "file_fpd");
            const fRabSipil = files.find(f => f.fieldname === "file_rab_sipil");
            const fRabMe = files.find(f => f.fieldname === "file_rab_me");

            const itemRegex = /^foto_items_(\d+)$/i;

            try {
                if (fFpd) {
                    const link = await uploadCompressedFile(fFpd, env.DOC_DRIVE_ROOT_ID);
                    if (link) fpdLink = link;
                }
                if (fRabSipil) {
                    const link = await uploadCompressedFile(fRabSipil, env.DOC_DRIVE_ROOT_ID);
                    if (link) rabSipilLink = link;
                }
                if (fRabMe) {
                    const link = await uploadCompressedFile(fRabMe, env.DOC_DRIVE_ROOT_ID);
                    if (link) rabMeLink = link;
                }

                // Process foto_items_X
                for (const file of files) {
                    const match = itemRegex.exec(file.fieldname);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        if (!isNaN(index)) {
                            const link = await uploadCompressedFile(file, env.DOC_DRIVE_ROOT_ID);
                            if (link) fotoItemsLinks.push({ item_index: index, link_foto: link });
                        }
                    }
                }
            } catch (e) {
                console.error("Gagal upload file FPD/RAB/Foto ke Drive:", e);
            }
        }

        // 5. Buat record baru langsung ke status WAITING_BM_APPROVAL
        const created = await projekPlanningRepository.create({
            ...payload,
            nama_toko: toko.nama_toko ?? null,
            kode_toko: toko.kode_toko ?? null,
            cabang: toko.cabang ?? null,
            proyek: toko.proyek ?? null,
            link_fpd: fpdLink ?? undefined,
            link_gambar_rab_sipil: rabSipilLink ?? undefined,
            link_gambar_rab_me: rabMeLink ?? undefined,
            status: PP_STATUS.WAITING_BM_APPROVAL,
        });

        // 6. Catat log
        await projekPlanningRepository.insertLog({
            projek_planning_id: created.id,
            actor_email: payload.email_pembuat,
            role: PP_ROLE.COORDINATOR,
            aksi: PP_AKSI.SUBMIT,
            status_sebelum: null,
            status_sesudah: PP_STATUS.WAITING_BM_APPROVAL,
            keterangan: "FPD berhasil diajukan oleh Coordinator, menunggu approval BM Manager",
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

        // Ambil data toko terbaru
        const toko = await tokoRepository.findById(projek.id_toko);
        if (!toko) {
            throw new AppError("Toko tidak ditemukan", 404);
        }

        // Upload file if provided
        let fpdLink = payload.link_fpd;
        let rabSipilLink = payload.link_gambar_rab_sipil;
        let rabMeLink = payload.link_gambar_rab_me;
        let fotoItemsLinks: { item_index: number; link_foto: string }[] = [];

        if (files && files.length > 0) {
            const fFpd = files.find(f => f.fieldname === "file_fpd");
            const fRabSipil = files.find(f => f.fieldname === "file_rab_sipil");
            const fRabMe = files.find(f => f.fieldname === "file_rab_me");

            const itemRegex = /^foto_items_(\d+)$/i;

            try {
                if (fFpd) {
                    const link = await uploadCompressedFile(fFpd, env.DOC_DRIVE_ROOT_ID);
                    if (link) fpdLink = link;
                }
                if (fRabSipil) {
                    const link = await uploadCompressedFile(fRabSipil, env.DOC_DRIVE_ROOT_ID);
                    if (link) rabSipilLink = link;
                }
                if (fRabMe) {
                    const link = await uploadCompressedFile(fRabMe, env.DOC_DRIVE_ROOT_ID);
                    if (link) rabMeLink = link;
                }

                // Process foto_items_X
                for (const file of files) {
                    const match = itemRegex.exec(file.fieldname);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        if (!isNaN(index)) {
                            const link = await uploadCompressedFile(file, env.DOC_DRIVE_ROOT_ID);
                            if (link) fotoItemsLinks.push({ item_index: index, link_foto: link });
                        }
                    }
                }
            } catch (e) {
                console.error("Gagal upload file FPD/RAB/Foto ke Drive:", e);
            }
        }

        // Update record DRAFT → WAITING_BM_APPROVAL
        const updated = await projekPlanningRepository.resubmitDraft(id, {
            ...payload,
            nama_toko: toko.nama_toko ?? null,
            kode_toko: toko.kode_toko ?? null,
            cabang: toko.cabang ?? null,
            proyek: toko.proyek ?? null,
            link_fpd: fpdLink ?? projek.link_fpd ?? undefined,
            link_gambar_rab_sipil: rabSipilLink ?? projek.link_gambar_rab_sipil ?? undefined,
            link_gambar_rab_me: rabMeLink ?? projek.link_gambar_rab_me ?? undefined,
            status: PP_STATUS.WAITING_BM_APPROVAL,
        });

        // Catat log
        await projekPlanningRepository.insertLog({
            projek_planning_id: id,
            actor_email: payload.email_pembuat,
            role: PP_ROLE.COORDINATOR,
            aksi: PP_AKSI.SUBMIT,
            status_sebelum: PP_STATUS.DRAFT,
            status_sesudah: PP_STATUS.WAITING_BM_APPROVAL,
            keterangan: "FPD diajukan ulang oleh Coordinator setelah penolakan, menunggu approval BM Manager",
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

        if (item.projek.status !== PP_STATUS.COMPLETED) {
            throw new AppError("PDF hanya bisa digenerate setelah project planning berstatus COMPLETED", 400);
        }

        return buildProjekPlanningPdfBuffer(item.projek);
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
        if (projek.status !== PP_STATUS.WAITING_BM_APPROVAL) {
            throw new AppError(
                `Aksi tidak valid. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        const isApprove = action.tindakan === "APPROVE";
        const newStatus = isApprove ? PP_STATUS.WAITING_PP_APPROVAL_1 : PP_STATUS.DRAFT;

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
                    ? "Disetujui oleh BM Manager, menunggu approval PP Specialist"
                    : `Ditolak oleh BM Manager: ${action.alasan_penolakan}. Dikembalikan ke Coordinator dari awal`,
            },
            isApprove
                ? (client) => projekPlanningRepository.updateStatusAndBmApproval(id, newStatus, action, client)
                : (client) => projekPlanningRepository.resetToDraft(id, client)
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
        let keterangan = `Ditolak oleh PP Specialist (Tahap 1): ${action.alasan_penolakan}. Dikembalikan ke Coordinator dari awal`;

        if (isApprove) {
            if (action.butuh_desain_3d) {
                newStatus = PP_STATUS.PP_DESIGN_3D_REQUIRED;
                keterangan = "Disetujui oleh PP Specialist, PP perlu membuat desain 3D";
            } else {
                newStatus = PP_STATUS.WAITING_RAB_UPLOAD;
                keterangan = "Disetujui oleh PP Specialist (tanpa 3D), Cabang dapat mengupload RAB & Gambar Kerja";
            }
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
                : (client) => projekPlanningRepository.resetToDraft(id, client)
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
                    env.DOC_DRIVE_ROOT_ID,
                    file.originalname,
                    file.mimetype,
                    file.buffer
                );
                if (uploaded.webViewLink) link3d = uploaded.webViewLink;
            } catch (e) {
                console.error("Gagal upload 3D ke Drive:", e);
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
        let linkRab = payload.link_rab;
        let linkGambar = payload.link_gambar_kerja;
        
        if (files) {
            const fRab = files["file_rab"]?.[0];
            const fGambar = files["file_gambar_kerja"]?.[0];
            
            try {
                if (fRab) {
                    const link = await uploadCompressedFile(fRab, env.DOC_DRIVE_ROOT_ID);
                    if (link) linkRab = link;
                }
                if (fGambar) {
                    const link = await uploadCompressedFile(fGambar, env.DOC_DRIVE_ROOT_ID);
                    if (link) linkGambar = link;
                }
            } catch (e) {
                console.error("Gagal upload RAB/Gambar ke Drive:", e);
            }
        }

        const newStatus = PP_STATUS.WAITING_PP_APPROVAL_2;

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: payload.uploader_email,
                role: PP_ROLE.COORDINATOR,
                aksi: PP_AKSI.UPLOAD_RAB,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                keterangan: payload.keterangan ?? "RAB & Gambar Kerja berhasil diupload, menunggu approval PP Specialist",
            },
            (client) => projekPlanningRepository.updateRabUpload(id, newStatus, { ...payload, link_rab: linkRab, link_gambar_kerja: linkGambar }, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            link_rab: linkRab ?? null,
            link_gambar_kerja: linkGambar ?? null,
        };
    },

    // ============================================================
    // PP APPROVAL STAGE 2 (PP Specialist, setelah RAB)
    // ============================================================

    async ppApproval2(id: number, action: ApprovalInput) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.WAITING_PP_APPROVAL_2) {
            throw new AppError(
                `Aksi tidak valid. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        const isApprove = action.tindakan === "APPROVE";
        const newStatus = isApprove ? PP_STATUS.WAITING_PP_MANAGER_APPROVAL : PP_STATUS.WAITING_RAB_UPLOAD;

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: action.approver_email,
                role: PP_ROLE.PP_SPECIALIST,
                aksi: isApprove ? PP_AKSI.APPROVE : PP_AKSI.REJECT,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                alasan_penolakan: action.alasan_penolakan ?? null,
                keterangan: isApprove
                    ? "Disetujui oleh PP Specialist, menunggu approval final PP Manager"
                    : `Ditolak oleh PP Specialist (Tahap 2): ${action.alasan_penolakan}. Dikembalikan ke Cabang untuk Upload ulang RAB & Gambar Kerja`,
            },
            isApprove
                ? (client) => projekPlanningRepository.updateStatusAndPp2Approval(id, newStatus, action, client)
                : (client) => projekPlanningRepository.resetToRabUpload(id, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            tindakan: action.tindakan,
        };
    },

    // ============================================================
    // PP MANAGER APPROVAL (Tahap Final)
    // ============================================================

    async ppManagerApproval(id: number, action: ApprovalInput) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);

        const { projek } = data;
        if (projek.status !== PP_STATUS.WAITING_PP_MANAGER_APPROVAL) {
            throw new AppError(
                `Aksi tidak valid. Status saat ini: ${PP_STATUS_LABEL[projek.status]}`,
                409
            );
        }

        const isApprove = action.tindakan === "APPROVE";
        const newStatus = isApprove ? PP_STATUS.COMPLETED : PP_STATUS.WAITING_RAB_UPLOAD;

        const { projek: updated } = await projekPlanningRepository.updateStatusWithLog(
            id,
            {
                actor_email: action.approver_email,
                role: PP_ROLE.PP_MANAGER,
                aksi: isApprove ? PP_AKSI.COMPLETE : PP_AKSI.REJECT,
                status_sebelum: projek.status,
                status_sesudah: newStatus,
                alasan_penolakan: action.alasan_penolakan ?? null,
                keterangan: isApprove
                    ? "Disetujui final oleh PP Manager. FPD dikirim ke Cabang. Project planning SELESAI."
                    : `Ditolak oleh PP Manager: ${action.alasan_penolakan}. Dikembalikan ke Cabang untuk Upload ulang RAB & Gambar Kerja`,
            },
            isApprove
                ? (client) => projekPlanningRepository.updateStatusAndPpManagerApproval(id, newStatus, action, client)
                : (client) => projekPlanningRepository.resetToRabUpload(id, client)
        );

        return {
            id,
            old_status: projek.status,
            new_status: updated.status,
            tindakan: action.tindakan,
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

    // ============================================================
    // GET ONE — full detail (dipakai proxy file & PDF)
    // ============================================================

    async getOne(id: number) {
        const data = await projekPlanningRepository.findById(id);
        if (!data) throw new AppError("Project planning tidak ditemukan", 404);
        return data.projek;
    },
};
